<?php
/**
 * Radial Obstruction Profile Generator
 * 
 * Derives 360° obstruction angle profiles from the structure geometry
 * already defined in class-stadium-database.php. This provides the same
 * data format as LiDAR-derived profiles, enabling the faster and more
 * accurate radial shade calculation path for all venues.
 * 
 * For venues that already have LiDAR profiles in the JSON files, those
 * take precedence (higher quality). This generator fills the gaps.
 * 
 * The radial profile is measured from pitch centre. For each azimuth
 * (0-355° at 5° steps, 0=North), we ray-cast outward and find the
 * maximum obstruction angle from all structures.
 * 
 * obstruction_angle = atan2(structure_height, distance_to_inner_edge)
 * 
 * For stands with roof overhang, the roof peak is used instead of
 * the stand wall height, extending the effective obstruction.
 * 
 * @package Gssh_Stadium
 * @since 1.0.1
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Radial_Profile_Generator {

    /**
     * Angular resolution for generated profiles (degrees)
     */
    const THETA_STEP = 5;

    /**
     * Generate radial obstruction profile from structure data
     * 
     * @param string $venue_id  Stadium ID in the database
     * @return array|null       Profile in standard format, or null if no structures
     */
    public static function generate( string $venue_id ): ?array {
        if ( ! class_exists( 'Gssh_Stadium_Database' ) ) {
            return null;
        }

        $stadium = Gssh_Stadium_Database::get_stadium( $venue_id );
        if ( ! $stadium || empty( $stadium['structures'] ) ) {
            return null;
        }

        $location   = Gssh_Stadium_Database::get_location( $venue_id );
        $field      = $stadium['field'] ?? [];
        $structures = $stadium['structures'];

        $sectors = [];

        for ( $theta = 0; $theta < 360; $theta += self::THETA_STEP ) {
            $sector = self::calculate_sector( $theta, $structures, $field );
            $sectors[] = $sector;
        }

        return [
            'stadium'           => $stadium['name'],
            'venue_id'          => $venue_id,
            'club'              => $stadium['club'] ?? '',
            'league'            => $stadium['league'] ?? '',
            'pitch_center'      => [
                'lat' => $location['lat'] ?? 0,
                'lon' => $location['lng'] ?? 0,
            ],
            'pitch_elevation_m' => $stadium['pitch_elevation_m'] ?? null,
            'theta_step_deg'    => self::THETA_STEP,
            'source'            => 'derived_from_structure_geometry',
            'quality'           => self::assess_quality( $structures ),
            'sectors'           => $sectors,
        ];
    }

    /**
     * Generate profiles for ALL venues in the database that don't already
     * have LiDAR-derived profiles.
     * 
     * @return array  Map of venue_id => profile
     */
    public static function generate_all_missing(): array {
        if ( ! class_exists( 'Gssh_Stadium_Database' ) ) {
            return [];
        }

        $all_ids   = Gssh_Stadium_Database::get_stadium_ids();
        $generated = [];

        foreach ( $all_ids as $venue_id ) {
            // Skip if LiDAR profile already exists
            if ( Gssh_Radial_Obstruction_Profile::has_profile( $venue_id ) ) {
                continue;
            }

            $profile = self::generate( $venue_id );
            if ( $profile && ! empty( $profile['sectors'] ) ) {
                $generated[ $venue_id ] = $profile;
            }
        }

        return $generated;
    }

    /**
     * Register generated profiles with the radial profile handler
     * so they're available for shade calculations.
     * 
     * Call this during plugin init, after LiDAR profiles are loaded.
     * LiDAR profiles take precedence since they're already indexed.
     * 
     * @return int Number of profiles registered
     */
    public static function register_generated_profiles(): int {
        $profiles = self::generate_all_missing();
        $count = 0;

        foreach ( $profiles as $venue_id => $profile ) {
            // Write to the static profile cache via the existing handler
            // We need to inject directly since there's no public setter.
            // The cleanest approach: generate a temp JSON and load it.
            // But for runtime efficiency, we'll extend the profile class.
            Gssh_Radial_Obstruction_Profile::register_runtime_profile( $venue_id, $profile );
            $count++;
        }

        return $count;
    }

    /**
     * Calculate obstruction for a single sector (azimuth direction)
     * 
     * Casts a ray from pitch centre at the given azimuth and finds
     * the maximum obstruction angle from all structures.
     * 
     * @param float $theta_deg   Azimuth in degrees (0=N, 90=E, 180=S, 270=W)
     * @param array $structures  Array of structure definitions
     * @param array $field       Field configuration
     * @return array             Sector data
     */
    private static function calculate_sector( float $theta_deg, array $structures, array $field ): array {
        $theta_rad  = deg2rad( $theta_deg );
        $ray_dx     = sin( $theta_rad );  // East component
        $ray_dy     = cos( $theta_rad );  // North component

        $max_angle    = 0;
        $max_distance = 0;
        $max_height   = 0;

        foreach ( $structures as $structure ) {
            // Skip roof membranes — they're handled separately as PAR filters
            if ( ( $structure['type'] ?? '' ) === 'roof' ) {
                continue;
            }

            $result = self::ray_intersect_structure( $ray_dx, $ray_dy, $structure );

            if ( $result === null ) {
                continue;
            }

            $distance = $result['distance'];
            $height   = $result['height'];

            if ( $distance <= 0 ) {
                continue;
            }

            $angle = rad2deg( atan2( $height, $distance ) );

            if ( $angle > $max_angle ) {
                $max_angle    = $angle;
                $max_distance = $distance;
                $max_height   = $height;
            }
        }

        return [
            'theta_deg'  => $theta_deg,
            'distance_m' => round( $max_distance, 1 ),
            'height_m'   => round( $max_height, 1 ),
            'angle_deg'  => round( $max_angle, 1 ),
        ];
    }

    /**
     * Find where a ray from origin intersects a rectangular structure
     * 
     * Returns the distance to the nearest edge of the structure along
     * the ray direction, and the effective height at that point (including
     * roof overhang if applicable).
     * 
     * @param float $ray_dx     Ray X direction (unit-ish)
     * @param float $ray_dy     Ray Y direction (unit-ish)
     * @param array $structure  Structure definition
     * @return array|null       ['distance' => m, 'height' => m] or null if no intersection
     */
    private static function ray_intersect_structure( float $ray_dx, float $ray_dy, array $structure ): ?array {
        $sx = $structure['position']['x'] ?? 0;
        $sy = $structure['position']['y'] ?? 0;
        $hw = ( $structure['width'] ?? 0 ) / 2;
        $hd = ( $structure['depth'] ?? 0 ) / 2;

        // Structure bounding box (axis-aligned)
        $x_min = $sx - $hw;
        $x_max = $sx + $hw;
        $y_min = $sy - $hd;
        $y_max = $sy + $hd;

        // Ray from origin (0,0) in direction (ray_dx, ray_dy)
        // Find intersection with the bounding box using slab method
        $t_min = 0;
        $t_max = 1e6;

        // X slabs
        if ( abs( $ray_dx ) > 1e-10 ) {
            $t1 = $x_min / $ray_dx;
            $t2 = $x_max / $ray_dx;
            if ( $t1 > $t2 ) { $tmp = $t1; $t1 = $t2; $t2 = $tmp; }
            $t_min = max( $t_min, $t1 );
            $t_max = min( $t_max, $t2 );
        } else {
            // Ray is parallel to Y axis — check if origin X is inside slab
            if ( 0 < $x_min || 0 > $x_max ) {
                return null; // No intersection possible
            }
        }

        // Y slabs
        if ( abs( $ray_dy ) > 1e-10 ) {
            $t1 = $y_min / $ray_dy;
            $t2 = $y_max / $ray_dy;
            if ( $t1 > $t2 ) { $tmp = $t1; $t1 = $t2; $t2 = $tmp; }
            $t_min = max( $t_min, $t1 );
            $t_max = min( $t_max, $t2 );
        } else {
            if ( 0 < $y_min || 0 > $y_max ) {
                return null;
            }
        }

        if ( $t_min > $t_max || $t_max <= 0 ) {
            return null; // No valid intersection
        }

        // Distance to the nearest edge facing us
        $t_entry = $t_min > 0 ? $t_min : $t_max;
        $distance = $t_entry; // Already in metres (ray direction is unit-scale from coordinate system)

        // Effective height: use roof peak if there's an overhang facing this direction
        $height = $structure['height'] ?? 0;

        if ( isset( $structure['roof_height'] ) && $structure['roof_height'] > $height ) {
            // The roof extends further. Use roof_height as the effective obstruction.
            // The overhang extends beyond the stand wall, so from pitch centre
            // the roof peak is what you see against the sky.
            $height = $structure['roof_height'];
        }

        return [
            'distance' => $distance,
            'height'   => $height,
        ];
    }

    /**
     * Assess quality of a generated profile based on input data quality
     * 
     * @param array $structures
     * @return string  'high', 'medium', or 'low'
     */
    private static function assess_quality( array $structures ): string {
        $total     = count( $structures );
        $verified  = 0;
        $estimated = 0;

        foreach ( $structures as $s ) {
            $quality = $s['height_quality'] ?? 'estimated';
            if ( $quality === 'verified' ) {
                $verified++;
            } elseif ( $quality === 'estimated' ) {
                $estimated++;
            }
        }

        if ( $verified === $total ) {
            return 'high';
        }
        if ( $estimated > $total / 2 ) {
            return 'low';
        }
        return 'medium';
    }

    /**
     * Export all generated profiles as JSON (for caching to file)
     * 
     * @return string JSON
     */
    public static function export_json(): string {
        $all_ids = Gssh_Stadium_Database::get_stadium_ids();
        $profiles = [];

        foreach ( $all_ids as $venue_id ) {
            $profile = self::generate( $venue_id );
            if ( $profile ) {
                $profiles[] = $profile;
            }
        }

        return json_encode( $profiles, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE );
    }
}
