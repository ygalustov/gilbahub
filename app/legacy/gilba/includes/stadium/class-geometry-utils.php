<?php
/**
 * Geometry Utilities for Shadow Calculations
 * 
 * Provides robust polygon operations including:
 * - Convex hull computation (Graham scan)
 * - Polygon union (convex hull approximation for shadow merging)
 * - Point-in-polygon testing (ray casting with edge case handling)
 * - Polygon area and centroid calculations
 * - Vertex winding normalisation
 * 
 * @package Gssh_Stadium
 * @since 1.2.12
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Geometry_Utils {
    
    /**
     * Epsilon for floating point comparisons
     */
    const EPSILON = 1e-10;
    
    /**
     * Compute convex hull of a set of points using Graham scan algorithm
     * 
     * @param array $points Array of [x, y] coordinates
     * @return array Convex hull vertices in counter-clockwise order
     */
    public static function convex_hull( array $points ): array {
        $n = count( $points );
        
        if ( $n < 3 ) {
            return $points;
        }
        
        // Remove duplicate points
        $points = self::remove_duplicate_points( $points );
        $n = count( $points );
        
        if ( $n < 3 ) {
            return $points;
        }
        
        // Find the bottom-most point (or left-most in case of tie)
        $min_idx = 0;
        for ( $i = 1; $i < $n; $i++ ) {
            if ( $points[$i][1] < $points[$min_idx][1] ||
                 ( abs( $points[$i][1] - $points[$min_idx][1] ) < self::EPSILON && 
                   $points[$i][0] < $points[$min_idx][0] ) ) {
                $min_idx = $i;
            }
        }
        
        // Place the bottom-most point at first position
        $temp = $points[0];
        $points[0] = $points[$min_idx];
        $points[$min_idx] = $temp;
        
        $pivot = $points[0];
        
        // Sort points by polar angle with respect to pivot
        $rest = array_slice( $points, 1 );
        usort( $rest, function( $a, $b ) use ( $pivot ) {
            $angle_a = atan2( $a[1] - $pivot[1], $a[0] - $pivot[0] );
            $angle_b = atan2( $b[1] - $pivot[1], $b[0] - $pivot[0] );
            
            if ( abs( $angle_a - $angle_b ) < self::EPSILON ) {
                // Same angle - sort by distance (keep farthest)
                $dist_a = self::distance_squared( $pivot, $a );
                $dist_b = self::distance_squared( $pivot, $b );
                return $dist_a <=> $dist_b;
            }
            
            return $angle_a <=> $angle_b;
        });
        
        $points = array_merge( [ $pivot ], $rest );
        
        // Remove points with same angle (keep farthest)
        $filtered = [ $points[0] ];
        for ( $i = 1; $i < count( $points ); $i++ ) {
            while ( $i < count( $points ) - 1 ) {
                $angle_i = atan2( 
                    $points[$i][1] - $pivot[1], 
                    $points[$i][0] - $pivot[0] 
                );
                $angle_next = atan2( 
                    $points[$i + 1][1] - $pivot[1], 
                    $points[$i + 1][0] - $pivot[0] 
                );
                
                if ( abs( $angle_i - $angle_next ) < self::EPSILON ) {
                    $i++;
                } else {
                    break;
                }
            }
            $filtered[] = $points[$i];
        }
        
        $points = $filtered;
        $n = count( $points );
        
        if ( $n < 3 ) {
            return $points;
        }
        
        // Build convex hull using stack
        $stack = [ $points[0], $points[1], $points[2] ];
        
        for ( $i = 3; $i < $n; $i++ ) {
            // Remove points that make clockwise turn
            while ( count( $stack ) > 1 ) {
                $top = $stack[ count( $stack ) - 1 ];
                $second = $stack[ count( $stack ) - 2 ];
                
                if ( self::cross_product_orientation( $second, $top, $points[$i] ) <= 0 ) {
                    array_pop( $stack );
                } else {
                    break;
                }
            }
            $stack[] = $points[$i];
        }
        
        return $stack;
    }
    
    /**
     * Compute union of two polygons using convex hull
     * 
     * For shadow calculations, the convex hull of both polygons
     * provides a conservative (slightly larger) union that ensures
     * no shadow area is missed.
     * 
     * @param array $polygon1 First polygon vertices
     * @param array $polygon2 Second polygon vertices
     * @return array Union polygon vertices
     */
    public static function polygon_union( array $polygon1, array $polygon2 ): array {
        if ( empty( $polygon1 ) ) {
            return $polygon2;
        }
        if ( empty( $polygon2 ) ) {
            return $polygon1;
        }
        
        // Combine all vertices and compute convex hull
        $all_points = array_merge( $polygon1, $polygon2 );
        
        return self::convex_hull( $all_points );
    }
    
    /**
     * Construct a proper shadow polygon from structure base and projected vertices
     * 
     * This creates a valid non-self-intersecting polygon by computing
     * the convex hull of the original footprint and projected shadow points.
     * 
     * @param array $base_vertices    Structure footprint vertices
     * @param float $shadow_dx        Shadow X offset
     * @param float $shadow_dy        Shadow Y offset
     * @return array Shadow polygon vertices
     */
    public static function construct_shadow_polygon( 
        array $base_vertices, 
        float $shadow_dx, 
        float $shadow_dy 
    ): array {
        
        if ( empty( $base_vertices ) ) {
            return [];
        }
        
        // Create projected vertices
        $projected = [];
        foreach ( $base_vertices as $vertex ) {
            $projected[] = [
                $vertex[0] + $shadow_dx,
                $vertex[1] + $shadow_dy,
            ];
        }
        
        // Combine base and projected vertices
        $all_points = array_merge( $base_vertices, $projected );
        
        // Return convex hull for a proper non-self-intersecting polygon
        return self::convex_hull( $all_points );
    }
    
    /**
     * Point-in-polygon test using ray casting algorithm
     * 
     * Handles edge cases including:
     * - Points exactly on edges
     * - Points at vertices
     * - Horizontal edges
     * - Empty polygons
     * 
     * @param array $point   [x, y] coordinate
     * @param array $polygon Array of [x, y] vertices
     * @return bool True if point is inside or on the polygon boundary
     */
    public static function point_in_polygon( array $point, array $polygon ): bool {
        $n = count( $polygon );
        
        if ( $n < 3 ) {
            return false;
        }
        
        $x = $point[0];
        $y = $point[1];
        
        // First check if point is on any edge (including vertices)
        if ( self::point_on_polygon_boundary( $point, $polygon ) ) {
            return true;
        }
        
        // Ray casting algorithm
        $inside = false;
        $j = $n - 1;
        
        for ( $i = 0; $i < $n; $i++ ) {
            $xi = $polygon[$i][0];
            $yi = $polygon[$i][1];
            $xj = $polygon[$j][0];
            $yj = $polygon[$j][1];
            
            // Check if the ray crosses this edge
            if ( ( ( $yi > $y ) !== ( $yj > $y ) ) &&
                 ( $x < ( $xj - $xi ) * ( $y - $yi ) / ( $yj - $yi ) + $xi ) ) {
                $inside = ! $inside;
            }
            
            $j = $i;
        }
        
        return $inside;
    }
    
    /**
     * Check if a point lies on the polygon boundary
     * 
     * @param array $point   [x, y] coordinate
     * @param array $polygon Array of [x, y] vertices
     * @return bool True if point is on any edge
     */
    public static function point_on_polygon_boundary( array $point, array $polygon ): bool {
        $n = count( $polygon );
        
        for ( $i = 0; $i < $n; $i++ ) {
            $j = ( $i + 1 ) % $n;
            
            if ( self::point_on_segment( $point, $polygon[$i], $polygon[$j] ) ) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check if a point lies on a line segment
     * 
     * @param array $point [x, y] coordinate
     * @param array $a     Segment start [x, y]
     * @param array $b     Segment end [x, y]
     * @return bool True if point is on segment
     */
    public static function point_on_segment( array $point, array $a, array $b ): bool {
        $px = $point[0];
        $py = $point[1];
        $ax = $a[0];
        $ay = $a[1];
        $bx = $b[0];
        $by = $b[1];
        
        // Check if point is within bounding box
        $min_x = min( $ax, $bx ) - self::EPSILON;
        $max_x = max( $ax, $bx ) + self::EPSILON;
        $min_y = min( $ay, $by ) - self::EPSILON;
        $max_y = max( $ay, $by ) + self::EPSILON;
        
        if ( $px < $min_x || $px > $max_x || $py < $min_y || $py > $max_y ) {
            return false;
        }
        
        // Check collinearity using cross product
        $cross = ( $py - $ay ) * ( $bx - $ax ) - ( $px - $ax ) * ( $by - $ay );
        
        return abs( $cross ) < self::EPSILON;
    }
    
    /**
     * Calculate the signed area of a polygon
     * 
     * Uses the shoelace formula.
     * Positive for counter-clockwise winding, negative for clockwise.
     * 
     * @param array $polygon Array of [x, y] vertices
     * @return float Signed area
     */
    public static function polygon_signed_area( array $polygon ): float {
        $n = count( $polygon );
        
        if ( $n < 3 ) {
            return 0.0;
        }
        
        $area = 0.0;
        
        for ( $i = 0; $i < $n; $i++ ) {
            $j = ( $i + 1 ) % $n;
            $area += $polygon[$i][0] * $polygon[$j][1];
            $area -= $polygon[$j][0] * $polygon[$i][1];
        }
        
        return $area / 2.0;
    }
    
    /**
     * Calculate the absolute area of a polygon
     * 
     * @param array $polygon Array of [x, y] vertices
     * @return float Absolute area
     */
    public static function polygon_area( array $polygon ): float {
        return abs( self::polygon_signed_area( $polygon ) );
    }
    
    /**
     * Calculate polygon centroid
     * 
     * @param array $polygon Array of [x, y] vertices
     * @return array [x, y] centroid coordinate
     */
    public static function polygon_centroid( array $polygon ): array {
        $n = count( $polygon );
        
        if ( $n === 0 ) {
            return [ 0, 0 ];
        }
        
        if ( $n === 1 ) {
            return $polygon[0];
        }
        
        if ( $n === 2 ) {
            return [
                ( $polygon[0][0] + $polygon[1][0] ) / 2,
                ( $polygon[0][1] + $polygon[1][1] ) / 2,
            ];
        }
        
        $cx = 0.0;
        $cy = 0.0;
        $area = 0.0;
        $j = $n - 1;
        
        for ( $i = 0; $i < $n; $i++ ) {
            $cross = $polygon[$j][0] * $polygon[$i][1] - 
                     $polygon[$i][0] * $polygon[$j][1];
            $area += $cross;
            $cx += ( $polygon[$j][0] + $polygon[$i][0] ) * $cross;
            $cy += ( $polygon[$j][1] + $polygon[$i][1] ) * $cross;
            $j = $i;
        }
        
        $area /= 2.0;
        
        if ( abs( $area ) < self::EPSILON ) {
            // Degenerate polygon - return average of vertices
            $sum_x = array_sum( array_column( $polygon, 0 ) );
            $sum_y = array_sum( array_column( $polygon, 1 ) );
            return [ $sum_x / $n, $sum_y / $n ];
        }
        
        $cx /= ( 6.0 * $area );
        $cy /= ( 6.0 * $area );
        
        return [ $cx, $cy ];
    }
    
    /**
     * Normalise polygon vertices to counter-clockwise winding
     * 
     * @param array $polygon Array of [x, y] vertices
     * @return array Vertices in counter-clockwise order
     */
    public static function normalise_winding( array $polygon ): array {
        if ( count( $polygon ) < 3 ) {
            return $polygon;
        }
        
        $area = self::polygon_signed_area( $polygon );
        
        // If area is negative, polygon is clockwise - reverse it
        if ( $area < 0 ) {
            return array_reverse( $polygon );
        }
        
        return $polygon;
    }
    
    /**
     * Check if polygon winding is counter-clockwise
     * 
     * @param array $polygon Array of [x, y] vertices
     * @return bool True if counter-clockwise
     */
    public static function is_counter_clockwise( array $polygon ): bool {
        return self::polygon_signed_area( $polygon ) > 0;
    }
    
    /**
     * Calculate bounding box of a polygon
     * 
     * @param array $polygon Array of [x, y] vertices
     * @return array ['min_x', 'max_x', 'min_y', 'max_y']
     */
    public static function bounding_box( array $polygon ): array {
        if ( empty( $polygon ) ) {
            return [
                'min_x' => 0,
                'max_x' => 0,
                'min_y' => 0,
                'max_y' => 0,
            ];
        }
        
        $xs = array_column( $polygon, 0 );
        $ys = array_column( $polygon, 1 );
        
        return [
            'min_x' => min( $xs ),
            'max_x' => max( $xs ),
            'min_y' => min( $ys ),
            'max_y' => max( $ys ),
        ];
    }
    
    /**
     * Check if two bounding boxes overlap
     * 
     * @param array $box1 First bounding box
     * @param array $box2 Second bounding box
     * @return bool True if boxes overlap
     */
    public static function boxes_overlap( array $box1, array $box2 ): bool {
        return ! (
            $box1['max_x'] < $box2['min_x'] ||
            $box2['max_x'] < $box1['min_x'] ||
            $box1['max_y'] < $box2['min_y'] ||
            $box2['max_y'] < $box1['min_y']
        );
    }
    
    /**
     * Calculate intersection area of two convex polygons (approximate)
     * 
     * Uses Monte Carlo sampling for complex intersections.
     * 
     * @param array $polygon1   First polygon
     * @param array $polygon2   Second polygon
     * @param int   $samples    Number of samples for Monte Carlo
     * @return float Approximate intersection area
     */
    public static function intersection_area( 
        array $polygon1, 
        array $polygon2, 
        int $samples = 1000 
    ): float {
        
        // Quick bounding box check
        $box1 = self::bounding_box( $polygon1 );
        $box2 = self::bounding_box( $polygon2 );
        
        if ( ! self::boxes_overlap( $box1, $box2 ) ) {
            return 0.0;
        }
        
        // Find intersection bounding box
        $int_box = [
            'min_x' => max( $box1['min_x'], $box2['min_x'] ),
            'max_x' => min( $box1['max_x'], $box2['max_x'] ),
            'min_y' => max( $box1['min_y'], $box2['min_y'] ),
            'max_y' => min( $box1['max_y'], $box2['max_y'] ),
        ];
        
        $box_area = ( $int_box['max_x'] - $int_box['min_x'] ) * 
                    ( $int_box['max_y'] - $int_box['min_y'] );
        
        if ( $box_area <= 0 ) {
            return 0.0;
        }
        
        // Monte Carlo sampling
        $hits = 0;
        for ( $i = 0; $i < $samples; $i++ ) {
            $x = $int_box['min_x'] + ( mt_rand() / mt_getrandmax() ) * 
                 ( $int_box['max_x'] - $int_box['min_x'] );
            $y = $int_box['min_y'] + ( mt_rand() / mt_getrandmax() ) * 
                 ( $int_box['max_y'] - $int_box['min_y'] );
            
            if ( self::point_in_polygon( [ $x, $y ], $polygon1 ) &&
                 self::point_in_polygon( [ $x, $y ], $polygon2 ) ) {
                $hits++;
            }
        }
        
        return $box_area * ( $hits / $samples );
    }
    
    // -------------------------------------------------------------------------
    // Private helper methods
    // -------------------------------------------------------------------------
    
    /**
     * Calculate squared distance between two points
     */
    private static function distance_squared( array $a, array $b ): float {
        $dx = $b[0] - $a[0];
        $dy = $b[1] - $a[1];
        return $dx * $dx + $dy * $dy;
    }
    
    /**
     * Cross product orientation test
     * 
     * Returns:
     * - Positive: counter-clockwise turn
     * - Negative: clockwise turn
     * - Zero: collinear
     */
    private static function cross_product_orientation( array $a, array $b, array $c ): float {
        return ( $b[0] - $a[0] ) * ( $c[1] - $a[1] ) - 
               ( $b[1] - $a[1] ) * ( $c[0] - $a[0] );
    }
    
    /**
     * Remove duplicate points from array
     */
    private static function remove_duplicate_points( array $points ): array {
        $unique = [];
        $seen = [];
        
        foreach ( $points as $point ) {
            // Round to avoid floating point comparison issues
            $key = round( $point[0], 6 ) . ',' . round( $point[1], 6 );
            
            if ( ! isset( $seen[ $key ] ) ) {
                $seen[ $key ] = true;
                $unique[] = $point;
            }
        }
        
        return $unique;
    }
}
