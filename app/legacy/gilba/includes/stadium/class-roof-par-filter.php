<?php
/**
 * Roof PAR Transmittance Module
 * 
 * Stadium roofs filter photosynthetically active radiation (PAR) before it
 * reaches the playing surface. Different roof materials have different
 * transmittance characteristics:
 * 
 *   Material                    PAR transmittance    Source
 *   PTFE (Teflon) coated glass   10-15%             Sherratt 2016
 *   ETFE cushion (clear)         83-90%             Vector Foiltec specs
 *   ETFE cushion (printed)       38-50%             Vector Foiltec specs
 *   Polycarbonate (clear)        75-85%             Generic specs
 *   Polycarbonate (tinted)       40-60%             Generic specs
 *   Glass (clear)                80-90%             Standard
 *   Glass (tinted/coated)        40-70%             Varies
 *   Retractable (open)           100%               No filtering
 *   Retractable (closed)         Depends on material
 *   Opaque (metal/concrete)      0%                 No light transmission
 * 
 * The module:
 *   1. Determines which zones are under roof overhang
 *   2. Applies the appropriate PAR transmittance multiplier
 *   3. Adjusts the effective DLI for those zones
 *   4. Works alongside the obstruction profile shade calculation
 * 
 * References:
 *   - Sherratt, P.J. (2016). Light and shade in stadium turf management.
 *     International Turfgrass Society Research Journal, 13.
 *   - STRI Technical Note: Managing grass under stadium roofs (2019)
 *   - Vector Foiltec ETFE specification sheets
 *   - Luo, Y. & Li, H. (2018). Daylight performance of ETFE cushion.
 *     Building and Environment, 132, 51-61.
 * 
 * @package Gssh_Stadium
 * @since 1.0.1
 */

class Gssh_Roof_PAR_Filter {

    /**
     * PAR transmittance coefficients by roof material type
     * 
     * Values represent fraction of PAR that passes through (0.0 - 1.0)
     * These are conservative estimates for turf management decisions.
     */
    const TRANSMITTANCE = [
        'ptfe'                 => 0.13,   // PTFE coated fibreglass — Sherratt 2016
        'ptfe_fibreglass'      => 0.13,
        'etfe_clear'           => 0.87,   // ETFE single-layer clear — Vector Foiltec
        'etfe_cushion'         => 0.83,   // ETFE multi-layer cushion — Luo & Li 2018
        'etfe_printed'         => 0.45,   // ETFE with frit/print pattern
        'etfe_variable'        => 0.65,   // ETFE with pneumatic opacity control (avg)
        'polycarbonate_clear'  => 0.80,
        'polycarbonate_tinted' => 0.50,
        'glass_clear'          => 0.85,
        'glass_tinted'         => 0.55,
        'glass_low_e'          => 0.65,   // Low-emissivity coated
        'retractable_open'     => 1.00,
        'retractable_closed'   => 0.00,   // Override per material when closed
        'opaque'               => 0.00,
        'open'                 => 1.00,   // No roof / open sky
    ];

    /**
     * Known roof configurations for specific venues
     * 
     * Maps venue_id to roof zone definitions with material types.
     * The 'coverage_zones' define which areas of the field are under
     * each roof section.
     * 
     * Zone coordinates are relative to field centre (0,0), in metres.
     */
    const VENUE_ROOF_CONFIGS = [
        'commbank_stadium' => [
            'description' => '23,400m² PTFE membrane + 4,600m² ETFE halo ring. Full coverage.',
            'zones' => [
                [
                    'name'        => 'PTFE main roof',
                    'material'    => 'ptfe',
                    'coverage'    => 'overhang',   // Only covers the overhang zone near stands
                    'overhang_m'  => 10,            // Roof lip extends ~10m past stand inner edge over field
                ],
                [
                    'name'        => 'ETFE halo',
                    'material'    => 'etfe_clear',
                    'coverage'    => 'central',     // Central opening has ETFE
                    'notes'       => 'Near-transparent ETFE halo ring around central opening',
                ],
            ],
        ],
        'allianz_stadium_sydney' => [
            'description' => 'Full PTFE roof coverage, opened 2022.',
            'zones' => [
                [
                    'name'        => 'PTFE canopy',
                    'material'    => 'ptfe',
                    'coverage'    => 'overhang',
                    'overhang_m'  => 12,            // Roof lip ~12m past front row over field
                ],
            ],
        ],
        'tottenham_hotspur_stadium' => [
            'description' => 'ETFE cushion roof with retractable south stand.',
            'zones' => [
                [
                    'name'        => 'ETFE roof',
                    'material'    => 'etfe_cushion',
                    'coverage'    => 'overhang',
                    'overhang_m'  => 30,
                ],
            ],
        ],
        'sapporo_dome' => [
            'description' => 'Fully enclosed dome with hovering pitch system.',
            'zones' => [
                [
                    'name'        => 'Dome roof',
                    'material'    => 'opaque',
                    'coverage'    => 'full',
                    'notes'       => 'Pitch slides outdoors for sunlight. When indoors, PAR = 0.',
                ],
            ],
        ],
    ];

    /**
     * Calculate roof PAR adjustment for a venue
     * 
     * Returns a multiplier (0.0 - 1.0) representing how much PAR
     * reaches the playing surface after roof filtering.
     * 
     * For zones under opaque/PTFE overhang, this can significantly
     * reduce effective DLI even when the shade engine shows "sunlit"
     * (because the sun may be above the obstruction angle but the
     * roof membrane still filters the light).
     * 
     * @param string $venue_id   Venue identifier
     * @param float  $x          Field position X (metres from centre)
     * @param float  $y          Field position Y (metres from centre)
     * @param array  $structures Venue structures (for overhang geometry)
     * @return float PAR transmittance multiplier (0.0 - 1.0)
     */
    public static function get_par_multiplier( string $venue_id, float $x, float $y, array $structures = [] ): float {
        $config = self::VENUE_ROOF_CONFIGS[ $venue_id ] ?? null;

        if ( ! $config ) {
            // No roof config — check if venue has a 'roof' type structure
            return self::estimate_from_structures( $x, $y, $structures );
        }

        $min_transmittance = 1.0;

        foreach ( $config['zones'] as $zone ) {
            $material     = $zone['material'];
            $coverage     = $zone['coverage'];
            $transmittance = self::TRANSMITTANCE[ $material ] ?? 1.0;

            $is_under = false;

            switch ( $coverage ) {
                case 'full':
                    $is_under = true;
                    break;

                case 'overhang':
                    $overhang_m = $zone['overhang_m'] ?? 20;
                    $is_under = self::point_under_overhang( $x, $y, $structures, $overhang_m );
                    break;

                case 'central':
                    // Central zone — between the overhangs
                    $is_under = ! self::point_under_overhang( $x, $y, $structures, 0 );
                    break;
            }

            if ( $is_under && $transmittance < $min_transmittance ) {
                $min_transmittance = $transmittance;
            }
        }

        return $min_transmittance;
    }

    /**
     * Calculate venue-wide average PAR multiplier across the playing surface
     * 
     * @param string $venue_id
     * @param array  $field       Field config with playing_length/width
     * @param array  $structures
     * @param float  $resolution  Grid sampling resolution (metres)
     * @return array  ['average' => float, 'grid' => [...], 'zones' => [...]]
     */
    public static function calculate_venue_par_map(
        string $venue_id,
        array $field,
        array $structures,
        float $resolution = 5.0
    ): array {
        $length = $field['playing_length'] ?? $field['length'] ?? 100;
        $width  = $field['playing_width'] ?? $field['width'] ?? 68;

        $grid = [];
        $total = 0;
        $sum   = 0;

        for ( $x = -$width / 2; $x <= $width / 2; $x += $resolution ) {
            for ( $y = -$length / 2; $y <= $length / 2; $y += $resolution ) {
                $par = self::get_par_multiplier( $venue_id, $x, $y, $structures );
                $grid[] = [ 'x' => $x, 'y' => $y, 'par' => $par ];
                $sum += $par;
                $total++;
            }
        }

        return [
            'venue_id'     => $venue_id,
            'average_par'  => $total > 0 ? round( $sum / $total, 3 ) : 1.0,
            'grid'         => $grid,
            'grid_size'    => $total,
            'resolution_m' => $resolution,
        ];
    }

    /**
     * Get effective DLI after roof filtering
     * 
     * The shade engine already accounts for direct beam obstruction via the
     * radial profile or shadow polygons. The roof PAR filter handles the
     * separate effect of translucent roof materials filtering diffuse skylight.
     * 
     * Physical model:
     *   effective_DLI = direct_beam_DLI + (diffuse_DLI × roof_PAR_transmittance)
     * 
     * The shade engine's DLI output includes both direct and diffuse components.
     * We decompose it using the direct/diffuse fraction, then apply the roof
     * filter only to the diffuse component.
     * 
     * References:
     *   - Diffuse fraction varies 0.20 (clear sky) to 0.80 (overcast)
     *   - Default 0.35 for clear-sky summer conditions (Perez et al. 1990)
     *   - Ambient DLI estimator provides cloud-adjusted values
     * 
     * @param float  $shade_dli       DLI from shade engine (already adjusted for obstruction)
     * @param string $venue_id        Venue
     * @param float  $x               Field position X
     * @param float  $y               Field position Y
     * @param array  $structures      Venue structures
     * @param float  $diffuse_fraction Fraction of ambient PAR that is diffuse (0.0-1.0)
     * @return array ['effective_dli', 'roof_par', 'direct_dli', 'diffuse_dli', 'roof_loss_pct']
     */
    public static function apply_roof_filter(
        float $shade_dli,
        string $venue_id,
        float $x,
        float $y,
        array $structures = [],
        float $diffuse_fraction = 0.35
    ): array {
        $par_multiplier = self::get_par_multiplier( $venue_id, $x, $y, $structures );

        // Decompose shade engine DLI into direct beam and diffuse components
        // Note: shade_dli already has direct beam obstruction factored in.
        // The diffuse component is reduced by the shade engine too (sky view factor),
        // but we approximate by using the full diffuse fraction here.
        $direct_dli  = $shade_dli * ( 1 - $diffuse_fraction );
        $diffuse_dli = $shade_dli * $diffuse_fraction;

        // Apply roof transmittance only to diffuse component
        // Direct beam either clears the roof (already counted by shade engine)
        // or is blocked (already excluded by shade engine's obstruction check)
        $filtered_diffuse = $diffuse_dli * $par_multiplier;
        $effective_dli    = $direct_dli + $filtered_diffuse;

        $loss_pct = $shade_dli > 0
            ? ( 1 - $effective_dli / $shade_dli ) * 100
            : 0;

        return [
            'effective_dli' => round( $effective_dli, 1 ),
            'roof_par'      => round( $par_multiplier, 3 ),
            'direct_dli'    => round( $direct_dli, 1 ),
            'diffuse_dli'   => round( $filtered_diffuse, 1 ),
            'roof_loss_pct' => round( max( 0, $loss_pct ), 1 ),
            'shade_dli'     => round( $shade_dli, 1 ),
        ];
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Check if a field point is under a roof overhang
     * 
     * A point is "under overhang" if it's within overhang_m metres of
     * any stand's inner edge. The overhang extends inward from the stand
     * toward field centre.
     * 
     * @param float $x           Field X position
     * @param float $y           Field Y position
     * @param array $structures  Venue structures
     * @param float $overhang_m  Overhang distance (metres into field)
     * @return bool
     */
    private static function point_under_overhang( float $x, float $y, array $structures, float $overhang_m ): bool {
        foreach ( $structures as $s ) {
            if ( ( $s['type'] ?? '' ) === 'roof' ) {
                continue; // Skip the roof structure itself
            }

            $sx = $s['position']['x'] ?? 0;
            $sy = $s['position']['y'] ?? 0;
            $hw = ( $s['width'] ?? 0 ) / 2;
            $hd = ( $s['depth'] ?? 0 ) / 2;

            // Stand's inner edge + overhang zone
            // For each stand, check if point is within the overhang strip

            // West-side stand (sx < 0): inner edge at sx + hw, overhang extends to sx + hw + overhang_m
            if ( $sx < -10 ) {
                $inner_x = $sx + $hw;
                if ( $x >= $inner_x && $x <= $inner_x + $overhang_m ) {
                    if ( $y >= $sy - $hd && $y <= $sy + $hd ) {
                        return true;
                    }
                }
            }

            // East-side stand (sx > 0): inner edge at sx - hw, overhang extends to sx - hw - overhang_m
            if ( $sx > 10 ) {
                $inner_x = $sx - $hw;
                if ( $x <= $inner_x && $x >= $inner_x - $overhang_m ) {
                    if ( $y >= $sy - $hd && $y <= $sy + $hd ) {
                        return true;
                    }
                }
            }

            // North end (sy > 0): inner edge at sy - hd, overhang extends to sy - hd - overhang_m
            if ( $sy > 10 ) {
                $inner_y = $sy - $hd;
                if ( $y <= $inner_y && $y >= $inner_y - $overhang_m ) {
                    if ( $x >= $sx - $hw && $x <= $sx + $hw ) {
                        return true;
                    }
                }
            }

            // South end (sy < -10): inner edge at sy + hd, overhang extends to sy + hd + overhang_m
            if ( $sy < -10 ) {
                $inner_y = $sy + $hd;
                if ( $y >= $inner_y && $y <= $inner_y + $overhang_m ) {
                    if ( $x >= $sx - $hw && $x <= $sx + $hw ) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Estimate PAR filtering from structure data when no explicit roof config exists
     * 
     * Checks for 'roof' type structures with permeability values.
     * 
     * @param float $x
     * @param float $y
     * @param array $structures
     * @return float PAR multiplier
     */
    private static function estimate_from_structures( float $x, float $y, array $structures ): float {
        foreach ( $structures as $s ) {
            if ( ( $s['type'] ?? '' ) !== 'roof' ) {
                continue;
            }

            $sx = $s['position']['x'] ?? 0;
            $sy = $s['position']['y'] ?? 0;
            $hw = ( $s['width'] ?? 0 ) / 2;
            $hd = ( $s['depth'] ?? 0 ) / 2;

            // Check if point is under this roof structure's footprint
            if ( $x >= $sx - $hw && $x <= $sx + $hw &&
                 $y >= $sy - $hd && $y <= $sy + $hd ) {
                // Use the structure's permeability as PAR transmittance
                // (rough approximation — permeability was set for shadow purposes)
                return $s['permeability'] ?? 0.5;
            }
        }

        return 1.0; // No roof overhead — full PAR
    }
}
