<?php
/**
 * Shade Engine Interface
 * 
 * Contract for hemisphere-aware shade calculation that accounts for:
 * - Sun path based on latitude/longitude and date
 * - Structure geometry and orientation
 * - Time-weighted shade factors per zone
 * 
 * @package Gssh_Stadium
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

interface Gssh_Shade_Engine_Interface {
    
    /**
     * Calculate composite shade factor for a zone
     * 
     * Returns a time-weighted shade factor representing the fraction of 
     * available daylight that reaches the zone after accounting for shadows
     * cast by surrounding structures.
     * 
     * @param array  $zone_geometry   Zone position and bounds
     * @param array  $structures      Structures that may cast shadows
     * @param array  $location        Venue location [lat, lng, timezone]
     * @param string $date            Date in Y-m-d format
     * @return array {
     *     @type float  $shade_factor        0.0 (full shade) to 1.0 (full sun)
     *     @type float  $morning_factor      Shade factor for morning hours (sunrise to noon)
     *     @type float  $afternoon_factor    Shade factor for afternoon hours (noon to sunset)
     *     @type array  $hourly_factors      Shade factor per hour of daylight
     *     @type array  $primary_obstructions Structures causing most shade
     *     @type string $confidence          'high', 'medium', 'low'
     * }
     */
    public function calculate_zone_shade_factor( 
        array $zone_geometry, 
        array $structures, 
        array $location, 
        string $date 
    ): array;
    
    /**
     * Get sun position for a specific datetime
     * 
     * @param array  $location  [lat, lng, timezone]
     * @param string $datetime  ISO 8601 datetime
     * @return array {
     *     @type float $azimuth    Sun azimuth in degrees (0=N, 90=E, 180=S, 270=W)
     *     @type float $elevation  Sun elevation in degrees (0=horizon, 90=zenith)
     *     @type bool  $is_daylight Whether sun is above horizon
     * }
     */
    public function get_sun_position( array $location, string $datetime ): array;
    
    /**
     * Get sun path for an entire day
     * 
     * @param array  $location [lat, lng, timezone]
     * @param string $date     Date in Y-m-d format
     * @return array {
     *     @type string $sunrise      Sunrise time (H:i)
     *     @type string $sunset       Sunset time (H:i)
     *     @type string $solar_noon   Solar noon time (H:i)
     *     @type float  $max_elevation Maximum sun elevation at solar noon
     *     @type float  $noon_azimuth  Sun azimuth at solar noon (varies by hemisphere)
     *     @type float  $day_length   Day length in hours
     *     @type array  $path         Array of [time, azimuth, elevation] for each hour
     * }
     */
    public function get_sun_path( array $location, string $date ): array;
    
    /**
     * Calculate shadow projection from a structure
     * 
     * Projects the shadow cast by a structure onto a horizontal plane
     * at the pitch level for a specific sun position.
     * 
     * @param array $structure   Structure geometry
     * @param array $sun_position [azimuth, elevation]
     * @return array {
     *     @type array  $shadow_polygon  Vertices of shadow footprint [[x,y], ...]
     *     @type float  $shadow_length   Maximum shadow length in metres
     *     @type string $shadow_direction Cardinal direction shadow extends toward
     * }
     */
    public function calculate_shadow_projection( 
        array $structure, 
        array $sun_position 
    ): array;
    
    /**
     * Get structures for a venue
     * 
     * @param string $venue_id
     * @return array Array of structure definitions
     */
    public function get_structures( string $venue_id ): array;
    
    /**
     * Register or update a structure
     * 
     * @param string $venue_id
     * @param array  $structure Structure definition
     * @return bool Success
     */
    public function save_structure( string $venue_id, array $structure ): bool;
}

/**
 * Structure Definition Schema
 * 
 * Structures are defined with the following properties:
 * 
 * @example
 * $structure = [
 *     'structure_id'   => 'north_stand',
 *     'name'           => 'North Stand',
 *     'type'           => 'stand',           // stand, roof, building, tree, temporary
 *     
 *     // Position relative to pitch centre (metres)
 *     // Positive X = East, Positive Y = North
 *     'position'       => [
 *         'x'          => 0,                 // Centre-line of structure
 *         'y'          => 85,                // 85m north of pitch centre
 *     ],
 *     
 *     // Dimensions
 *     'width'          => 120,               // East-west extent (metres)
 *     'depth'          => 25,                // North-south extent (metres)  
 *     'height'         => 28,                // Height above pitch level (metres)
 *     
 *     // Roof overhang (for stands with cantilevered roofs)
 *     'roof_overhang'  => 15,                // Overhang toward pitch (metres)
 *     'roof_height'    => 32,                // Height of roof edge
 *     
 *     // Optional: custom vertices for complex shapes
 *     // If provided, overrides width/depth rectangle
 *     'vertices'       => [                  // Clockwise from NW corner
 *         [-60, 97.5],                       // [x, y] relative to pitch centre
 *         [60, 97.5],
 *         [60, 72.5],
 *         [-60, 72.5],
 *     ],
 *     
 *     // Permeability - fraction of light that passes through
 *     'permeability'   => 0.0,               // 0.0 = solid, 1.0 = transparent
 *     
 *     // Seasonal variations (e.g., deciduous trees)
 *     'seasonal_permeability' => [
 *         'summer' => 0.1,                   // Dense foliage
 *         'winter' => 0.7,                   // Bare branches
 *     ],
 * ];
 */

/**
 * Zone Geometry Schema
 * 
 * Zones are defined with position and bounds:
 * 
 * @example
 * $zone_geometry = [
 *     'zone_id'    => 'zone_north',
 *     'name'       => 'North Goal Area',
 *     
 *     // Bounding rectangle (metres from pitch centre)
 *     'bounds'     => [
 *         'north'  => 52.5,
 *         'south'  => 35,
 *         'east'   => 20,
 *         'west'   => -20,
 *     ],
 *     
 *     // Or polygon vertices for irregular zones
 *     'vertices'   => [
 *         [-20, 52.5],
 *         [20, 52.5],
 *         [20, 35],
 *         [-20, 35],
 *     ],
 *     
 *     // Pitch surface level relative to datum (metres)
 *     'elevation'  => 0,
 *     
 *     // Grid resolution for shadow calculations (metres)
 *     'grid_resolution' => 2,
 * ];
 */

/**
 * Location Schema
 * 
 * @example
 * $location = [
 *     'lat'      => -33.8688,              // Negative = Southern Hemisphere
 *     'lng'      => 151.2093,
 *     'timezone' => 'Australia/Sydney',
 *     
 *     // Optional: venue orientation if pitch is not aligned N-S
 *     'pitch_orientation' => 15,           // Degrees clockwise from true north
 * ];
 */

/**
 * Hemisphere Behaviour Notes
 * 
 * SOUTHERN HEMISPHERE (negative latitude):
 * - Sun tracks across the NORTHERN sky
 * - At solar noon, sun is due NORTH (azimuth ≈ 0° or 360°)
 * - Shadows fall SOUTHWARD
 * - A "North Stand" shades the SOUTHERN portion of the pitch
 * - Summer = December-February (highest sun, shortest shadows)
 * - Winter = June-August (lowest sun, longest shadows)
 * 
 * NORTHERN HEMISPHERE (positive latitude):
 * - Sun tracks across the SOUTHERN sky
 * - At solar noon, sun is due SOUTH (azimuth ≈ 180°)
 * - Shadows fall NORTHWARD
 * - A "South Stand" shades the NORTHERN portion of the pitch
 * - Summer = June-August (highest sun, shortest shadows)
 * - Winter = December-February (lowest sun, longest shadows)
 * 
 * SHADOW LENGTH FORMULA:
 * shadow_length = structure_height / tan(sun_elevation)
 * 
 * At 30° elevation: shadow = 1.73 × height
 * At 45° elevation: shadow = 1.0 × height
 * At 60° elevation: shadow = 0.58 × height
 * 
 * EXAMPLE - Sydney Stadium (lat -33.87°):
 * 
 * Summer Solstice (Dec 21):
 *   - Max elevation: ~79° at noon
 *   - 28m stand casts 5.4m shadow at noon
 *   - Shadow direction: South
 *   
 * Winter Solstice (Jun 21):
 *   - Max elevation: ~33° at noon
 *   - 28m stand casts 43m shadow at noon
 *   - Shadow direction: South
 *   - Morning/afternoon shadows extend further as sun is lower
 * 
 * Equinox (Mar/Sep 21):
 *   - Max elevation: ~56° at noon
 *   - 28m stand casts 19m shadow at noon
 */
