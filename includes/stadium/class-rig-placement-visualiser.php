<?php
/**
 * Rig Placement Visualiser
 * 
 * Generates SVG visualisations of LED grow light rig placements,
 * showing coverage zones, DLI heatmaps, and health projections.
 * 
 * @package Gssh_Stadium
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Rig_Placement_Visualiser {
    
    /**
     * Colour scales for visualisation
     */
    const COLORS = [
        'deficit' => [
            'critical'    => '#dc2626',  // Red
            'significant' => '#ea580c',  // Orange
            'moderate'    => '#eab308',  // Yellow
            'minor'       => '#84cc16',  // Lime
            'adequate'    => '#22c55e',  // Green
        ],
        'health' => [
            'excellent' => '#22c55e',
            'good'      => '#84cc16',
            'stressed'  => '#eab308',
            'declining' => '#ea580c',
            'critical'  => '#dc2626',
        ],
        'rig' => [
            'coverage'  => 'rgba(147, 51, 234, 0.3)',   // Purple with transparency
            'border'    => '#9333ea',
            'highlight' => 'rgba(147, 51, 234, 0.5)',
        ],
        'field' => [
            'grass'     => '#16a34a',
            'lines'     => '#ffffff',
            'border'    => '#15803d',
        ],
    ];
    
    /**
     * Generate complete rig placement visualisation
     * 
     * @param array $analysis Analysis result from Gssh_Rig_Placement_Calculator
     * @param array $options Visualisation options
     * @return string SVG markup
     */
    public function generate_placement_visualisation( array $analysis, array $options = [] ): string {
        $options = wp_parse_args( $options, [
            'width'           => 800,
            'height'          => 600,
            'show_deficit'    => true,
            'show_rigs'       => true,
            'show_legend'     => true,
            'show_stats'      => true,
            'animate_rigs'    => false,
        ]);
        
        $field_dims = $analysis['shade_analysis']['field_dims'];
        
        // Calculate scale to fit field in view
        $padding = 60;
        $available_width = $options['width'] - ( $padding * 2 );
        $available_height = $options['height'] - ( $padding * 2 ) - ( $options['show_stats'] ? 100 : 0 );
        
        $scale_x = $available_width / $field_dims['width'];
        $scale_y = $available_height / $field_dims['length'];
        $scale = min( $scale_x, $scale_y );
        
        $field_width = $field_dims['width'] * $scale;
        $field_height = $field_dims['length'] * $scale;
        $offset_x = ( $options['width'] - $field_width ) / 2;
        $offset_y = $padding;
        
        ob_start();
        ?>
        <svg xmlns="http://www.w3.org/2000/svg" 
             viewBox="0 0 <?php echo $options['width']; ?> <?php echo $options['height']; ?>"
             class="gssh-rig-placement-svg">
            
            <defs>
                <!-- Rig coverage gradient -->
                <radialGradient id="rig-coverage-gradient">
                    <stop offset="0%" stop-color="rgba(147, 51, 234, 0.5)" />
                    <stop offset="70%" stop-color="rgba(147, 51, 234, 0.3)" />
                    <stop offset="100%" stop-color="rgba(147, 51, 234, 0.1)" />
                </radialGradient>
                
                <!-- Field pattern -->
                <pattern id="grass-pattern" patternUnits="userSpaceOnUse" width="20" height="20">
                    <rect width="20" height="20" fill="<?php echo self::COLORS['field']['grass']; ?>" />
                    <rect x="0" y="0" width="10" height="20" fill="rgba(0,0,0,0.03)" />
                </pattern>
                
                <!-- Drop shadow -->
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3"/>
                </filter>
                
                <?php if ( $options['animate_rigs'] ) : ?>
                <style>
                    .rig-coverage { animation: pulse 2s ease-in-out infinite; }
                    @keyframes pulse {
                        0%, 100% { opacity: 0.3; }
                        50% { opacity: 0.5; }
                    }
                </style>
                <?php endif; ?>
            </defs>
            
            <!-- Background -->
            <rect width="100%" height="100%" fill="#f1f5f9" />
            
            <!-- Title -->
            <text x="<?php echo $options['width'] / 2; ?>" y="25" 
                  text-anchor="middle" fill="#111827" font-size="16" font-weight="bold">
                <?php echo esc_html( $analysis['venue_name'] ); ?> - Rig Placement Analysis
            </text>
            <text x="<?php echo $options['width'] / 2; ?>" y="42" 
                  text-anchor="middle" fill="#6b7280" font-size="11">
                <?php echo esc_html( $analysis['rig_type'] ); ?> rigs | 
                Target DLI: <?php echo $analysis['target_dli']; ?> mol/m²/day | 
                <?php echo esc_html( $analysis['analysis_period'] ); ?> analysis
            </text>
            
            <!-- Field -->
            <g transform="translate(<?php echo $offset_x; ?>, <?php echo $offset_y; ?>)">
                
                <!-- Field background -->
                <rect x="0" y="0" 
                      width="<?php echo $field_width; ?>" 
                      height="<?php echo $field_height; ?>" 
                      fill="url(#grass-pattern)" 
                      stroke="<?php echo self::COLORS['field']['border']; ?>" 
                      stroke-width="3" 
                      rx="5" />
                
                <!-- Field markings (simplified) -->
                <?php echo $this->render_field_markings( $field_width, $field_height, $field_dims ); ?>
                
                <!-- Deficit zones heatmap -->
                <?php if ( $options['show_deficit'] ) : ?>
                    <?php echo $this->render_deficit_heatmap( 
                        $analysis['deficit_zones'], 
                        $scale, 
                        $field_width, 
                        $field_height 
                    ); ?>
                <?php endif; ?>
                
                <!-- Rig placements -->
                <?php if ( $options['show_rigs'] ) : ?>
                    <?php echo $this->render_rig_placements( 
                        $analysis['placements'], 
                        $scale, 
                        $field_width, 
                        $field_height,
                        $options['animate_rigs']
                    ); ?>
                <?php endif; ?>
                
            </g>
            
            <!-- Legend -->
            <?php if ( $options['show_legend'] ) : ?>
                <?php echo $this->render_legend( $options['width'], $offset_y + $field_height + 20 ); ?>
            <?php endif; ?>
            
            <!-- Stats panel -->
            <?php if ( $options['show_stats'] ) : ?>
                <?php echo $this->render_stats_panel( 
                    $analysis, 
                    $options['width'], 
                    $options['height'] - 90 
                ); ?>
            <?php endif; ?>
            
        </svg>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Render field markings
     */
    private function render_field_markings( float $width, float $height, array $dims ): string {
        $type = $dims['type'] ?? 'rectangular';
        $line_color = self::COLORS['field']['lines'];
        $line_opacity = 0.5;
        
        ob_start();
        
        if ( $type === 'oval' ) {
            // Centre circle
            $cx = $width / 2;
            $cy = $height / 2;
            ?>
            <circle cx="<?php echo $cx; ?>" cy="<?php echo $cy; ?>" r="<?php echo min( $width, $height ) * 0.1; ?>" 
                    fill="none" stroke="<?php echo $line_color; ?>" stroke-width="2" opacity="<?php echo $line_opacity; ?>" />
            <line x1="0" y1="<?php echo $cy; ?>" x2="<?php echo $width; ?>" y2="<?php echo $cy; ?>" 
                  stroke="<?php echo $line_color; ?>" stroke-width="2" opacity="<?php echo $line_opacity; ?>" />
            <?php
        } else {
            // Rectangular field markings
            $cx = $width / 2;
            $cy = $height / 2;
            $penalty_width = $width * 0.5;
            $penalty_depth = $height * 0.14;
            $goal_width = $width * 0.2;
            $goal_depth = $height * 0.05;
            ?>
            <!-- Centre line -->
            <line x1="0" y1="<?php echo $cy; ?>" x2="<?php echo $width; ?>" y2="<?php echo $cy; ?>" 
                  stroke="<?php echo $line_color; ?>" stroke-width="2" opacity="<?php echo $line_opacity; ?>" />
            
            <!-- Centre circle -->
            <circle cx="<?php echo $cx; ?>" cy="<?php echo $cy; ?>" r="<?php echo $width * 0.12; ?>" 
                    fill="none" stroke="<?php echo $line_color; ?>" stroke-width="2" opacity="<?php echo $line_opacity; ?>" />
            
            <!-- Penalty areas -->
            <rect x="<?php echo ( $width - $penalty_width ) / 2; ?>" y="0" 
                  width="<?php echo $penalty_width; ?>" height="<?php echo $penalty_depth; ?>" 
                  fill="none" stroke="<?php echo $line_color; ?>" stroke-width="2" opacity="<?php echo $line_opacity; ?>" />
            <rect x="<?php echo ( $width - $penalty_width ) / 2; ?>" y="<?php echo $height - $penalty_depth; ?>" 
                  width="<?php echo $penalty_width; ?>" height="<?php echo $penalty_depth; ?>" 
                  fill="none" stroke="<?php echo $line_color; ?>" stroke-width="2" opacity="<?php echo $line_opacity; ?>" />
            
            <!-- Goal areas -->
            <rect x="<?php echo ( $width - $goal_width ) / 2; ?>" y="0" 
                  width="<?php echo $goal_width; ?>" height="<?php echo $goal_depth; ?>" 
                  fill="none" stroke="<?php echo $line_color; ?>" stroke-width="2" opacity="<?php echo $line_opacity; ?>" />
            <rect x="<?php echo ( $width - $goal_width ) / 2; ?>" y="<?php echo $height - $goal_depth; ?>" 
                  width="<?php echo $goal_width; ?>" height="<?php echo $goal_depth; ?>" 
                  fill="none" stroke="<?php echo $line_color; ?>" stroke-width="2" opacity="<?php echo $line_opacity; ?>" />
            <?php
        }
        
        return ob_get_clean();
    }
    
    /**
     * Render deficit zones as heatmap
     */
    private function render_deficit_heatmap( array $deficit_zones, float $scale, float $width, float $height ): string {
        ob_start();
        
        $half_w = $width / 2;
        $half_h = $height / 2;
        $cell_size = 5 * $scale;
        
        foreach ( $deficit_zones['deficit_points'] as $point ) {
            $color = self::COLORS['deficit'][ $point['severity'] ] ?? '#888';
            
            // Convert from field coords (-half to +half) to SVG coords (0 to full)
            $px = $half_w + ( $point['x'] * $scale );
            $py = $half_h - ( $point['y'] * $scale );  // Y is inverted
            ?>
            <rect x="<?php echo $px - $cell_size / 2; ?>" 
                  y="<?php echo $py - $cell_size / 2; ?>" 
                  width="<?php echo $cell_size; ?>" 
                  height="<?php echo $cell_size; ?>" 
                  fill="<?php echo $color; ?>" 
                  opacity="0.6" />
            <?php
        }
        
        return ob_get_clean();
    }
    
    /**
     * Render rig placements
     */
    private function render_rig_placements( 
        array $placements, 
        float $scale, 
        float $field_width, 
        float $field_height,
        bool $animate 
    ): string {
        
        ob_start();
        
        $half_w = $field_width / 2;
        $half_h = $field_height / 2;
        
        // Render GHOST RIGS first (behind deployed rigs)
        if ( ! empty( $placements['ghost_rigs'] ) ) {
            foreach ( $placements['ghost_rigs'] as $rig ) {
                $pos = $rig['position'] ?? [ 'x' => $rig['x'] ?? 0, 'y' => $rig['y'] ?? 0 ];
                $bounds = $rig['bounds'];
                
                // Convert to SVG coordinates
                $cx = $half_w + ( $pos['x'] * $scale );
                $cy = $half_h - ( $pos['y'] * $scale );
                
                $rig_width = ( $bounds['max_x'] - $bounds['min_x'] ) * $scale;
                $rig_height = ( $bounds['max_y'] - $bounds['min_y'] ) * $scale;
                
                $rx = $cx - $rig_width / 2;
                $ry = $cy - $rig_height / 2;
                ?>
                <!-- Ghost Rig <?php echo esc_attr( $rig['rig_id'] ); ?> - recommended position -->
                <g class="ghost-rig-group" data-rig-id="<?php echo esc_attr( $rig['rig_id'] ); ?>" opacity="0.7">
                    <!-- Ghost coverage area - dashed border, more visible -->
                    <rect x="<?php echo $rx; ?>" y="<?php echo $ry; ?>" 
                          width="<?php echo $rig_width; ?>" height="<?php echo $rig_height; ?>" 
                          fill="rgba(251, 191, 36, 0.25)" 
                          stroke="#fbbf24" 
                          stroke-width="3" 
                          stroke-dasharray="10,5"
                          rx="4" />
                    
                    <!-- Ghost rig icon (centre) - amber/yellow -->
                    <circle cx="<?php echo $cx; ?>" cy="<?php echo $cy; ?>" r="14" 
                            fill="rgba(251, 191, 36, 0.3)" stroke="#fbbf24" stroke-width="2" />
                    <text x="<?php echo $cx; ?>" y="<?php echo $cy + 5; ?>" 
                          text-anchor="middle" fill="#fbbf24" font-size="14" font-weight="bold">+</text>
                    
                    <!-- Ghost label - more visible -->
                    <text x="<?php echo $cx; ?>" y="<?php echo $cy + 28; ?>" 
                          text-anchor="middle" fill="#fbbf24" font-size="10" font-weight="bold"
                          style="text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
                        +RIG <?php echo $rig['priority']; ?>
                    </text>
                </g>
                <?php
            }
        }
        
        // Render DEPLOYED RIGS (on top)
        foreach ( $placements['rigs'] as $rig ) {
            $pos = $rig['position'] ?? [ 'x' => $rig['x'] ?? 0, 'y' => $rig['y'] ?? 0 ];
            $bounds = $rig['bounds'];
            
            // Convert to SVG coordinates
            $cx = $half_w + ( $pos['x'] * $scale );
            $cy = $half_h - ( $pos['y'] * $scale );
            
            $rig_width = ( $bounds['max_x'] - $bounds['min_x'] ) * $scale;
            $rig_height = ( $bounds['max_y'] - $bounds['min_y'] ) * $scale;
            
            $rx = $cx - $rig_width / 2;
            $ry = $cy - $rig_height / 2;
            
            $class = $animate ? 'rig-coverage' : '';
            ?>
            <!-- Rig <?php echo esc_attr( $rig['rig_id'] ); ?> coverage -->
            <g class="rig-group" data-rig-id="<?php echo esc_attr( $rig['rig_id'] ); ?>">
                <!-- Outer glow for visibility -->
                <rect x="<?php echo $rx - 2; ?>" y="<?php echo $ry - 2; ?>" 
                      width="<?php echo $rig_width + 4; ?>" height="<?php echo $rig_height + 4; ?>" 
                      fill="none" 
                      stroke="#22c55e" 
                      stroke-width="4" 
                      stroke-opacity="0.3"
                      rx="5" />
                
                <!-- Coverage area - prominent border -->
                <rect x="<?php echo $rx; ?>" y="<?php echo $ry; ?>" 
                      width="<?php echo $rig_width; ?>" height="<?php echo $rig_height; ?>" 
                      fill="url(#rig-coverage-gradient)" 
                      stroke="#22c55e" 
                      stroke-width="3" 
                      rx="4"
                      class="<?php echo $class; ?>" />
                
                <!-- Inner border for clarity -->
                <rect x="<?php echo $rx + 3; ?>" y="<?php echo $ry + 3; ?>" 
                      width="<?php echo $rig_width - 6; ?>" height="<?php echo $rig_height - 6; ?>" 
                      fill="none" 
                      stroke="rgba(255,255,255,0.3)" 
                      stroke-width="1" 
                      stroke-dasharray="4,4"
                      rx="2" />
                
                <!-- Corner markers -->
                <line x1="<?php echo $rx; ?>" y1="<?php echo $ry + 10; ?>" 
                      x2="<?php echo $rx; ?>" y2="<?php echo $ry; ?>" stroke="#fff" stroke-width="2" />
                <line x1="<?php echo $rx; ?>" y1="<?php echo $ry; ?>" 
                      x2="<?php echo $rx + 10; ?>" y2="<?php echo $ry; ?>" stroke="#fff" stroke-width="2" />
                
                <line x1="<?php echo $rx + $rig_width - 10; ?>" y1="<?php echo $ry; ?>" 
                      x2="<?php echo $rx + $rig_width; ?>" y2="<?php echo $ry; ?>" stroke="#fff" stroke-width="2" />
                <line x1="<?php echo $rx + $rig_width; ?>" y1="<?php echo $ry; ?>" 
                      x2="<?php echo $rx + $rig_width; ?>" y2="<?php echo $ry + 10; ?>" stroke="#fff" stroke-width="2" />
                
                <line x1="<?php echo $rx + $rig_width; ?>" y1="<?php echo $ry + $rig_height - 10; ?>" 
                      x2="<?php echo $rx + $rig_width; ?>" y2="<?php echo $ry + $rig_height; ?>" stroke="#fff" stroke-width="2" />
                <line x1="<?php echo $rx + $rig_width; ?>" y1="<?php echo $ry + $rig_height; ?>" 
                      x2="<?php echo $rx + $rig_width - 10; ?>" y2="<?php echo $ry + $rig_height; ?>" stroke="#fff" stroke-width="2" />
                
                <line x1="<?php echo $rx + 10; ?>" y1="<?php echo $ry + $rig_height; ?>" 
                      x2="<?php echo $rx; ?>" y2="<?php echo $ry + $rig_height; ?>" stroke="#fff" stroke-width="2" />
                <line x1="<?php echo $rx; ?>" y1="<?php echo $ry + $rig_height; ?>" 
                      x2="<?php echo $rx; ?>" y2="<?php echo $ry + $rig_height - 10; ?>" stroke="#fff" stroke-width="2" />
                
                <!-- Rig icon (centre) -->
                <circle cx="<?php echo $cx; ?>" cy="<?php echo $cy; ?>" r="12" 
                        fill="#1e40af" stroke="#fff" stroke-width="2" />
                <circle cx="<?php echo $cx; ?>" cy="<?php echo $cy; ?>" r="4" 
                        fill="#22c55e" />
                
                <!-- Label -->
                <text x="<?php echo $cx; ?>" y="<?php echo $cy + 25; ?>" 
                      text-anchor="middle" fill="#fff" font-size="11" font-weight="bold"
                      style="text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
                    <?php echo esc_html( strtoupper( str_replace( '_', ' ', $rig['rig_id'] ) ) ); ?>
                </text>
                
                <!-- Priority badge -->
                <circle cx="<?php echo $rx + 14; ?>" cy="<?php echo $ry + 14; ?>" r="12" 
                        fill="#1e40af" stroke="#fff" stroke-width="2" />
                <text x="<?php echo $rx + 14; ?>" y="<?php echo $ry + 18; ?>" 
                      text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">
                    <?php echo $rig['priority']; ?>
                </text>
            </g>
            <?php
        }
        
        return ob_get_clean();
    }
    
    /**
     * Render legend
     */
    private function render_legend( float $svg_width, float $y_pos ): string {
        ob_start();
        
        $x_start = 20;
        $item_width = 100;
        ?>
        <g class="legend" transform="translate(<?php echo $x_start; ?>, <?php echo $y_pos; ?>)">
            <text x="0" y="0" fill="#6b7280" font-size="10" font-weight="bold">DEFICIT SEVERITY:</text>
            
            <?php
            $x = 0;
            $y = 15;
            foreach ( self::COLORS['deficit'] as $label => $color ) :
            ?>
                <rect x="<?php echo $x; ?>" y="<?php echo $y; ?>" width="12" height="12" 
                      fill="<?php echo $color; ?>" rx="2" />
                <text x="<?php echo $x + 16; ?>" y="<?php echo $y + 10; ?>" fill="#a1a1aa" font-size="9">
                    <?php echo ucfirst( $label ); ?>
                </text>
            <?php 
                $x += 75;
            endforeach;
            ?>
            
            <!-- Rig coverage legend -->
            <g transform="translate(<?php echo $x + 30; ?>, 0)">
                <text x="0" y="0" fill="#6b7280" font-size="10" font-weight="bold">RIG COVERAGE:</text>
                
                <!-- Deployed rig -->
                <rect x="0" y="15" width="20" height="12" 
                      fill="<?php echo self::COLORS['rig']['coverage']; ?>" 
                      stroke="#22c55e" 
                      stroke-width="2" rx="2" />
                <text x="24" y="25" fill="#a1a1aa" font-size="9">Deployed</text>
                
                <!-- Recommended rig (ghost) - amber/yellow -->
                <rect x="85" y="15" width="20" height="12" 
                      fill="rgba(251, 191, 36, 0.25)" 
                      stroke="#fbbf24" 
                      stroke-width="2"
                      stroke-dasharray="4,2" rx="2" />
                <text x="109" y="25" fill="#a1a1aa" font-size="9">Recommended</text>
            </g>
        </g>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Render stats panel
     */
    private function render_stats_panel( array $analysis, float $svg_width, float $y_pos ): string {
        $placements = $analysis['placements'];
        $coverage = $analysis['coverage'];
        $health = $analysis['health_projection'];
        
        ob_start();
        ?>
        <g class="stats-panel" transform="translate(20, <?php echo $y_pos; ?>)">
            <rect x="0" y="0" width="<?php echo $svg_width - 40; ?>" height="80" 
                  fill="#f1f5f9" rx="5" />
            
            <!-- Stats boxes -->
            <?php
            $stats = [
                [
                    'label' => 'Rigs Required',
                    'value' => $placements['total_rigs'],
                    'unit'  => '',
                    'color' => '#9333ea',
                ],
                [
                    'label' => 'Coverage',
                    'value' => $coverage['coverage_percent'],
                    'unit'  => '%',
                    'color' => '#22c55e',
                ],
                [
                    'label' => 'DLI per Rig',
                    'value' => $coverage['dli_per_rig_day'],
                    'unit'  => ' mol',
                    'color' => '#eab308',
                ],
                [
                    'label' => 'Covered Zones',
                    'value' => round( $health['with_supplement']['final_covered'] ?? 0 ),
                    'unit'  => '%',
                    'color' => '#22c55e',
                ],
                (function() use ( $health ) {
                    $h = $health['with_supplement']['final_uncovered'] ?? $health['without_supplement']['final_health'] ?? 100;
                    $label = $h <= 10 ? 'CRITICAL' : ( $h <= 35 ? 'SEVERE' : ( $h <= 65 ? 'MODERATE' : ( $h <= 85 ? 'LOW RISK' : 'STABLE' ) ) );
                    $color = $h <= 10 ? '#dc2626' : ( $h <= 35 ? '#f97316' : ( $h <= 65 ? '#eab308' : ( $h <= 85 ? '#84cc16' : '#22c55e' ) ) );
                    return [ 'label' => 'Uncovered Zones', 'value' => $label, 'unit' => '', 'color' => $color, 'font_size' => 11 ];
                })(),
                (function() use ( $health ) {
                    $h = $health['without_supplement']['final_health'] ?? 0;
                    $label = $h <= 10 ? 'CRITICAL' : ( $h <= 35 ? 'SEVERE' : ( $h <= 65 ? 'MODERATE' : ( $h <= 85 ? 'LOW RISK' : 'STABLE' ) ) );
                    $color = $h <= 10 ? '#dc2626' : ( $h <= 35 ? '#f97316' : ( $h <= 65 ? '#eab308' : ( $h <= 85 ? '#84cc16' : '#22c55e' ) ) );
                    return [ 'label' => 'Without Light', 'value' => $label, 'unit' => '', 'color' => $color, 'font_size' => 11 ];
                })(),
            ];
            
            $box_width = ( $svg_width - 40 - 20 ) / count( $stats );
            $x = 10;
            
            foreach ( $stats as $stat ) :
                $stat_id = 'gssh-svg-' . sanitize_title( $stat['label'] );
            ?>
                <g transform="translate(<?php echo $x; ?>, 10)">
                    <text x="<?php echo $box_width / 2; ?>" y="15" 
                          text-anchor="middle" fill="#9ca3af" font-size="9">
                        <?php echo $stat['label']; ?>
                    </text>
                    <?php 
                    $is_label = isset( $stat['font_size'] );
                    $val_size = $is_label ? $stat['font_size'] : 22;
                    $val_y    = $is_label ? 42 : 45;
                    ?>
                    <text id="<?php echo $stat_id; ?>" 
                          x="<?php echo $box_width / 2; ?>" y="<?php echo $val_y; ?>" 
                          text-anchor="middle" fill="<?php echo $stat['color']; ?>" 
                          font-size="<?php echo $val_size; ?>" font-weight="bold">
                        <?php echo $stat['value']; ?><?php if ( $stat['unit'] ) : ?><tspan font-size="12"><?php echo $stat['unit']; ?></tspan><?php endif; ?>
                    </text>
                </g>
            <?php 
                $x += $box_width;
            endforeach;
            ?>
            
            <!-- Effectiveness badge -->
            <?php
            $effectiveness = $coverage['effectiveness'];
            $eff_colors = [
                'excellent' => '#22c55e',
                'good'      => '#84cc16',
                'moderate'  => '#eab308',
                'limited'   => '#dc2626',
            ];
            $eff_color = $eff_colors[ $effectiveness ] ?? '#888';
            ?>
            <rect x="<?php echo $svg_width - 140; ?>" y="55" width="80" height="20" 
                  fill="<?php echo $eff_color; ?>" rx="10" />
            <text x="<?php echo $svg_width - 100; ?>" y="69" 
                  text-anchor="middle" fill="#000" font-size="10" font-weight="bold">
                <?php echo strtoupper( $effectiveness ); ?>
            </text>
        </g>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Generate health trajectory chart
     * 
     * Shows projected turf health over time with/without supplemental lighting.
     * 
     * @param array $health_projection Health projection from analysis
     * @param array $options Chart options
     * @return string SVG markup
     */
    public function generate_health_trajectory_chart( array $health_projection, array $options = [] ): string {
        $options = wp_parse_args( $options, [
            'width'  => 600,
            'height' => 300,
        ]);
        
        $without = $health_projection['without_supplement']['trajectory'];
        $with = $health_projection['with_supplement']['trajectory'];
        $days = count( $without );
        
        // Check if we have covered/uncovered breakdown
        $has_partial_coverage = isset( $with[0]['covered'] ) && isset( $with[0]['uncovered'] );
        $coverage_ratio = $health_projection['coverage_ratio'] ?? 1.0;
        
        $padding = [ 'top' => 40, 'right' => 30, 'bottom' => 50, 'left' => 50 ];
        $chart_width = $options['width'] - $padding['left'] - $padding['right'];
        $chart_height = $options['height'] - $padding['top'] - $padding['bottom'];
        
        // Scale functions
        $x_scale = fn( $d ) => $padding['left'] + ( $d / ( $days - 1 ) ) * $chart_width;
        $y_scale = fn( $h ) => $padding['top'] + $chart_height - ( $h / 100 ) * $chart_height;
        
        ob_start();
        ?>
        <svg xmlns="http://www.w3.org/2000/svg" 
             viewBox="0 0 <?php echo $options['width']; ?> <?php echo $options['height']; ?>"
             class="gssh-health-trajectory-svg">
            
            <rect width="100%" height="100%" fill="#f1f5f9" />
            
            <!-- Title -->
            <text x="<?php echo $options['width'] / 2; ?>" y="20" 
                  text-anchor="middle" fill="#111827" font-size="14" font-weight="bold">
                Projected Turf Health Over <?php echo $days; ?> Days
                <?php if ( $has_partial_coverage && $coverage_ratio < 1.0 ) : ?>
                    <tspan fill="#9ca3af" font-size="11"> (<?php echo round( $coverage_ratio * 100 ); ?>% coverage)</tspan>
                <?php endif; ?>
            </text>
            
            <!-- Chart area -->
            <g class="chart-area">
                <!-- Grid lines -->
                <?php for ( $h = 0; $h <= 100; $h += 25 ) : ?>
                    <line x1="<?php echo $padding['left']; ?>" 
                          y1="<?php echo $y_scale( $h ); ?>" 
                          x2="<?php echo $options['width'] - $padding['right']; ?>" 
                          y2="<?php echo $y_scale( $h ); ?>" 
                          stroke="#cbd5e1" stroke-width="1" />
                    <text x="<?php echo $padding['left'] - 8; ?>" y="<?php echo $y_scale( $h ) + 4; ?>" 
                          text-anchor="end" fill="#6b7280" font-size="10">
                        <?php echo $h; ?>%
                    </text>
                <?php endfor; ?>
                
                <!-- Threshold zones -->
                <rect x="<?php echo $padding['left']; ?>" 
                      y="<?php echo $y_scale( 100 ); ?>" 
                      width="<?php echo $chart_width; ?>" 
                      height="<?php echo $y_scale( 70 ) - $y_scale( 100 ); ?>" 
                      fill="rgba(34, 197, 94, 0.1)" />
                <rect x="<?php echo $padding['left']; ?>" 
                      y="<?php echo $y_scale( 70 ); ?>" 
                      width="<?php echo $chart_width; ?>" 
                      height="<?php echo $y_scale( 40 ) - $y_scale( 70 ); ?>" 
                      fill="rgba(234, 179, 8, 0.1)" />
                <rect x="<?php echo $padding['left']; ?>" 
                      y="<?php echo $y_scale( 40 ); ?>" 
                      width="<?php echo $chart_width; ?>" 
                      height="<?php echo $y_scale( 0 ) - $y_scale( 40 ); ?>" 
                      fill="rgba(220, 38, 38, 0.1)" />
                
                <!-- Without supplement line (entire pitch) - RED -->
                <polyline 
                    points="<?php 
                        $points = [];
                        foreach ( $without as $p ) {
                            $points[] = $x_scale( $p['day'] ) . ',' . $y_scale( $p['health'] );
                        }
                        echo implode( ' ', $points );
                    ?>" 
                    fill="none" 
                    stroke="#ef4444" 
                    stroke-width="3" 
                    stroke-linecap="round"
                    stroke-linejoin="round" />
                
                <?php if ( $has_partial_coverage && $coverage_ratio < 0.95 ) : ?>
                    <!-- Uncovered zones line (dashed) - ORANGE -->
                    <polyline 
                        points="<?php 
                            $points = [];
                            foreach ( $with as $p ) {
                                $points[] = $x_scale( $p['day'] ) . ',' . $y_scale( $p['uncovered'] );
                            }
                            echo implode( ' ', $points );
                        ?>" 
                        fill="none" 
                        stroke="#fb923c" 
                        stroke-width="2" 
                        stroke-dasharray="8,4"
                        stroke-linecap="round"
                        stroke-linejoin="round" />
                    
                    <!-- Covered zones line - CYAN/TEAL -->
                    <polyline 
                        points="<?php 
                            $points = [];
                            foreach ( $with as $p ) {
                                $points[] = $x_scale( $p['day'] ) . ',' . $y_scale( $p['covered'] );
                            }
                            echo implode( ' ', $points );
                        ?>" 
                        fill="none" 
                        stroke="#06b6d4" 
                        stroke-width="2" 
                        stroke-linecap="round"
                        stroke-linejoin="round" />
                <?php endif; ?>
                
                <!-- Overall with supplement line (weighted average) - BRIGHT GREEN -->
                <polyline 
                    points="<?php 
                        $points = [];
                        foreach ( $with as $p ) {
                            $points[] = $x_scale( $p['day'] ) . ',' . $y_scale( $p['health'] );
                        }
                        echo implode( ' ', $points );
                    ?>" 
                    fill="none" 
                    stroke="#4ade80" 
                    stroke-width="4" 
                    stroke-linecap="round"
                    stroke-linejoin="round" />
                
                <!-- X-axis labels -->
                <?php 
                $x_step = max( 1, floor( $days / 7 ) );
                for ( $d = 0; $d < $days; $d += $x_step ) : 
                ?>
                    <text x="<?php echo $x_scale( $d ); ?>" 
                          y="<?php echo $options['height'] - $padding['bottom'] + 20; ?>" 
                          text-anchor="middle" fill="#6b7280" font-size="10">
                        Day <?php echo $d; ?>
                    </text>
                <?php endfor; ?>
                
                <!-- Axis labels -->
                <text x="<?php echo $options['width'] / 2; ?>" 
                      y="<?php echo $options['height'] - 10; ?>" 
                      text-anchor="middle" fill="#6b7280" font-size="11">
                    Days
                </text>
                <text x="15" y="<?php echo $options['height'] / 2; ?>" 
                      text-anchor="middle" fill="#6b7280" font-size="11"
                      transform="rotate(-90, 15, <?php echo $options['height'] / 2; ?>)">
                    Turf Health %
                </text>
            </g>
            
            <!-- Legend -->
            <g transform="translate(<?php echo $padding['left'] + 20; ?>, <?php echo $padding['top'] + 10; ?>)">
                <line x1="0" y1="0" x2="20" y2="0" stroke="#ef4444" stroke-width="3" />
                <text x="25" y="4" fill="#6b7280" font-size="10">Without supplemental light</text>
                
                <line x1="0" y1="18" x2="20" y2="18" stroke="#4ade80" stroke-width="4" />
                <text x="25" y="22" fill="#6b7280" font-size="10">With supplemental light (overall)</text>
                
                <?php if ( $has_partial_coverage && $coverage_ratio < 0.95 ) : ?>
                <line x1="200" y1="0" x2="220" y2="0" stroke="#06b6d4" stroke-width="2" />
                <text x="225" y="4" fill="#6b7280" font-size="10">Covered zones</text>
                
                <line x1="200" y1="18" x2="220" y2="18" stroke="#fb923c" stroke-width="2" stroke-dasharray="8,4" />
                <text x="225" y="22" fill="#6b7280" font-size="10">Uncovered zones</text>
                <?php endif; ?>
            </g>
            
            <!-- End values -->
            <g class="end-values">
                <?php $final_without = end( $without ); $final_with = end( $with ); ?>
                <text x="<?php echo $x_scale( $days - 1 ) + 5; ?>" 
                      y="<?php echo $y_scale( $final_without['health'] ); ?>" 
                      fill="#ef4444" font-size="11" font-weight="bold">
                    <?php echo $final_without['health']; ?>%
                </text>
                <text x="<?php echo $x_scale( $days - 1 ) + 5; ?>" 
                      y="<?php echo $y_scale( $final_with['health'] ); ?>" 
                      fill="#4ade80" font-size="11" font-weight="bold">
                    <?php echo $final_with['health']; ?>%
                </text>
            </g>
            
        </svg>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Generate combined analysis view
     * 
     * @param array $analysis Complete analysis from calculator
     * @param array $options Display options
     * @return string HTML with multiple SVGs and data
     */
    public function generate_complete_analysis_view( array $analysis, array $options = [] ): string {
        ob_start();
        
        // Get variety display name
        $variety_key = $analysis['variety'] ?? 'unknown';
        $variety_names = [
            'tiftuf'        => 'TifTuf Bermuda',
            'tifdwarf'      => 'TifDwarf Bermuda',
            'tifgrand'      => 'TifGrand Bermuda',
            'tahoma31'      => 'Tahoma 31 Bermuda',
            'legend'        => 'Legend Couch',
            'wintergreen'   => 'Wintergreen Couch',
            'santa_ana'     => 'Santa Ana Couch',
            'platinum_te'   => 'Platinum TE',
            'kikuyu'        => 'Kikuyu',
            'perennial_rye' => 'Perennial Ryegrass',
            'ryegrass'      => 'Perennial Ryegrass',
            'zeon'          => 'Zeon Zoysia',
        ];
        $variety_display = $variety_names[ $variety_key ] ?? ucwords( str_replace( '_', ' ', $variety_key ) );
        
        // Calculate minimum rigs
        $deficit_area = $analysis['deficit_zones']['total_deficit_area'] ?? 0;
        $rig_coverage = $analysis['rig_spec']['coverage_m2'] ?? 400;
        $priority_zones = $analysis['placements']['priority_zones'] ?? 0;
        $priority_area = $analysis['placements']['priority_area'] ?? 0;
        $priority_coverage = $analysis['placements']['priority_coverage'] ?? 0;
        $strategy = $analysis['placements']['strategy'] ?? 'shade_priority';
        $min_rigs = $analysis['placements']['min_rigs_needed'] ?? 0;
        $current_rigs = $analysis['placements']['total_rigs'] ?? 0;
        
        // Get analysis month
        $analysis_month_name = $analysis['analysis_month_name'] ?? date( 'F' );
        
        ?>
        <div class="gssh-rig-analysis-complete">
            
            <!-- Summary header -->
            <div class="gssh-analysis-summary" style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="color: #111827; margin: 0 0 10px;">
                    <?php echo esc_html( $analysis['venue_name'] ); ?> - Supplemental Light Requirements
                    <span style="color: #60a5fa; font-weight: normal; font-size: 16px;">(<?php echo esc_html( $analysis_month_name ); ?>)</span>
                </h3>
                <p style="color: #6b7280; margin: 0 0 15px; font-size: 14px;">
                    <?php echo esc_html( $analysis['summary']['recommendation'] ); ?>
                </p>
                
                <?php if ( $strategy === 'not_required' ) : ?>
                <div style="background: rgba(34, 197, 94, 0.2); border: 1px solid #22c55e; border-radius: 6px; padding: 12px 16px; margin-bottom: 15px;">
                    <strong style="color: #166534;">✓ No Supplemental Lighting Required:</strong>
                    <span style="color: #15803d;">
                        Ambient light levels are adequate for turf health. No rig deployment needed this month.
                    </span>
                </div>
                <?php elseif ( $strategy === 'severe_deficit' ) : ?>
                <div style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; border-radius: 6px; padding: 12px 16px; margin-bottom: 15px;">
                    <strong style="color: #991b1b;">⚠️ Severe Light Deficit:</strong>
                    <span style="color: #b91c1c;">
                        Ambient DLI critically low. <?php echo $current_rigs; ?> rig<?php echo $current_rigs !== 1 ? 's' : ''; ?> deployed to worst-affected zones.
                        <?php if ( $priority_coverage < 80 ) : ?>
                        Additional rigs recommended for adequate coverage.
                        <?php endif; ?>
                    </span>
                </div>
                <?php elseif ( $strategy === 'moderate_deficit' ) : ?>
                <div style="background: rgba(234, 179, 8, 0.2); border: 1px solid #eab308; border-radius: 6px; padding: 12px 16px; margin-bottom: 15px;">
                    <strong style="color: #854d0e;">⚡ Moderate Light Deficit:</strong>
                    <span style="color: #a16207;">
                        <?php echo $current_rigs; ?> rig<?php echo $current_rigs !== 1 ? 's' : ''; ?> targeting critical and significant deficit zones.
                    </span>
                </div>
                <?php elseif ( $strategy === 'shade_pockets' ) : ?>
                <div style="background: rgba(59, 130, 246, 0.2); border: 1px solid #3b82f6; border-radius: 6px; padding: 12px 16px; margin-bottom: 15px;">
                    <strong style="color: #1e40af;">ℹ️ Shade Pocket Treatment:</strong>
                    <span style="color: #1d4ed8;">
                        Ambient light adequate but localised shade zones require <?php echo $current_rigs; ?> rig<?php echo $current_rigs !== 1 ? 's' : ''; ?>.
                    </span>
                </div>
                <?php endif; ?>
                
                <!-- Variety and DLI info -->
                <div style="display: flex; gap: 30px; flex-wrap: wrap; padding: 15px; background: #f1f5f9; border-radius: 6px;">
                    <div>
                        <span style="color: #4b5563; font-size: 11px; text-transform: uppercase;">Analysis Month</span>
                        <div style="color: #60a5fa; font-weight: bold; font-size: 16px;"><?php echo esc_html( $analysis_month_name ); ?></div>
                    </div>
                    <div>
                        <span style="color: #4b5563; font-size: 11px; text-transform: uppercase;">Turf Variety</span>
                        <div style="color: #22c55e; font-weight: bold; font-size: 16px;"><?php echo esc_html( $variety_display ); ?></div>
                    </div>
                    <div>
                        <span style="color: #4b5563; font-size: 11px; text-transform: uppercase;">Target DLI (minimum)</span>
                        <div style="color: #eab308; font-weight: bold; font-size: 16px;"><?php echo esc_html( $analysis['target_dli'] ); ?> mol/m²/day</div>
                    </div>
                    <div>
                        <span style="color: #4b5563; font-size: 11px; text-transform: uppercase;">Ambient DLI</span>
                        <?php 
                        $ambient = $analysis['deficit_zones']['ambient_dli'] ?? 0;
                        $target = $analysis['target_dli'] ?? 18;
                        $ambient_color = $ambient >= $target ? '#22c55e' : ( $ambient >= $target * 0.5 ? '#eab308' : '#ef4444' );
                        ?>
                        <div style="color: <?php echo $ambient_color; ?>; font-weight: bold; font-size: 16px;"><?php echo esc_html( $ambient ); ?> mol/m²/day</div>
                    </div>
                    <div>
                        <span style="color: #4b5563; font-size: 11px; text-transform: uppercase;">Max Deficit</span>
                        <div style="color: #f87171; font-weight: bold; font-size: 16px;"><?php echo esc_html( $analysis['deficit_zones']['max_deficit'] ?? '—' ); ?> mol/m²/day</div>
                    </div>
                    <?php if ( $strategy !== 'not_required' ) : ?>
                    <div>
                        <span style="color: #4b5563; font-size: 11px; text-transform: uppercase;">Total Deficit Area</span>
                        <div style="color: #7c3aed; font-weight: bold; font-size: 16px;"><?php echo number_format( $deficit_area ); ?> m²</div>
                    </div>
                    <?php endif; ?>
                    <?php if ( $priority_area > 0 && $priority_area < $deficit_area ) : ?>
                    <div>
                        <span style="color: #4b5563; font-size: 11px; text-transform: uppercase;">Priority Zones</span>
                        <div style="color: #f97316; font-weight: bold; font-size: 16px;"><?php echo number_format( $priority_area ); ?> m²</div>
                    </div>
                    <?php endif; ?>
                    <div>
                        <span style="color: #4b5563; font-size: 11px; text-transform: uppercase;">Min. Rigs (Priority Zones)</span>
                        <div style="color: #22c55e; font-weight: bold; font-size: 16px;">
                            <?php echo $current_rigs; ?> rig<?php echo $current_rigs !== 1 ? 's' : ''; ?>
                        </div>
                    </div>
                    <?php if ( isset( $analysis['placements']['total_weekly_hours'] ) && $analysis['placements']['total_weekly_hours'] > 0 ) : ?>
                    <div>
                        <span style="color: #4b5563; font-size: 11px; text-transform: uppercase;">Weekly Dwell Time</span>
                        <div style="color: #60a5fa; font-weight: bold; font-size: 16px;">
                            <?php echo number_format( $analysis['placements']['total_weekly_hours'], 0 ); ?> hours
                        </div>
                    </div>
                    <?php endif; ?>
                </div>
                
                <?php if ( ! empty( $analysis['placements']['capacity_warnings'] ) ) : ?>
                <div style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; border-radius: 6px; padding: 12px 16px; margin-top: 15px;">
                    <strong style="color: #991b1b;">⚠️ Deficit Exceeds Rig Capacity:</strong>
                    <div style="color: #b91c1c; margin-top: 8px; font-size: 13px;">
                        <?php foreach ( $analysis['placements']['capacity_warnings'] as $warning ) : ?>
                        <div style="margin-bottom: 4px;">
                            • <?php echo esc_html( $warning['message'] ); ?>
                        </div>
                        <?php endforeach; ?>
                    </div>
                    <div style="color: #991b1b; margin-top: 10px; font-size: 12px;">
                        <strong>Options:</strong> Increase dwell time, overlap rigs on worst zones, or accept reduced target (survival mode).
                    </div>
                </div>
                <?php endif; ?>
            </div>
            
            <?php if ( $strategy !== 'not_required' ) : 
                // Prepare zone data for JavaScript rotation + table rebuild
                $deployed_zones = [];
                foreach ( ($analysis['placements']['rigs'] ?? []) as $idx => $rig ) {
                    $deployed_zones[] = [
                        'x'       => round($rig['x'], 1),
                        'y'       => round($rig['y'], 1),
                        'deficit' => round($rig['deficit_addressed'] ?? 0, 1),
                        'rig_id'  => strtoupper($rig['rig_id'] ?? ('RIG_' . ($idx + 1))),
                        'hours'   => round($rig['hours_needed_daily'] ?? 0, 1),
                        'status'  => ($rig['can_meet_deficit'] ?? true) ? 'ok' : 'warning',
                        'shortfall' => round($rig['daily_shortfall'] ?? 0, 1),
                        'type'    => 'deployed',
                    ];
                }
                $ghost_zones = [];
                $rig_mol_per_hour = $analysis['rig_spec']['mol_per_hour'] ?? 1.1;
                foreach ( ($analysis['placements']['ghost_rigs'] ?? []) as $idx => $rig ) {
                    $ghost_deficit = $rig['deficit_addressed'] ?? 0;
                    $est_hours = $rig_mol_per_hour > 0 ? round($ghost_deficit / $rig_mol_per_hour, 1) : 0;
                    $ghost_zones[] = [
                        'x'       => round($rig['x'], 1),
                        'y'       => round($rig['y'], 1),
                        'deficit' => round($ghost_deficit, 1),
                        'rig_id'  => 'RIG ' . ($rig['priority'] ?? ($idx + count($deployed_zones) + 1)),
                        'hours'   => $est_hours,
                        'status'  => 'recommended',
                        'type'    => 'ghost',
                    ];
                }
                $all_zones = array_merge($deployed_zones, $ghost_zones);
                // Sort by deficit (highest first)
                usort($all_zones, fn($a, $b) => $b['deficit'] <=> $a['deficit']);
            ?>
            <!-- Coverage Slider Config v1.6.0 - Data attributes read by coverage-slider.js -->
            <?php
                // Prepare health projection params for client-side re-simulation
                $hp = $analysis['health_projection'] ?? [];
                $variety_params = [];
                if ( ! empty( $hp['without_supplement']['trajectory'] ) ) {
                    $variety_params = [
                        'without_trajectory' => $hp['without_supplement']['trajectory'],
                        'with_trajectory'    => $hp['with_supplement']['trajectory'] ?? [],
                        'coverage_ratio'     => $hp['coverage_ratio'] ?? 0.2,
                        'days'               => $hp['days_projected'] ?? 15,
                    ];
                }
                // Extract species params for JS re-simulation
                $species_params = $analysis['species_params'] ?? [];
                // Get the supplement DLI per rig from health projection
                $supplement_dli = $hp['supplement_dli_per_rig'] ?? 14.7;
            ?>
            <div id="gssh-slider-config" 
                 data-deficit-area="<?php echo (int) $deficit_area; ?>"
                 data-rig-coverage="<?php echo (int) $rig_coverage; ?>"
                 data-current-rigs="<?php echo (int) $current_rigs; ?>"
                 data-ghost-rigs="<?php echo (int) count( $analysis['placements']['ghost_rigs'] ?? [] ); ?>"
                 data-total-deficit-points="<?php echo (int) ($analysis['placements']['priority_zones'] ?? 0); ?>"
                 data-zones="<?php echo esc_attr( json_encode( $all_zones ) ); ?>"
                 data-month-name="<?php echo esc_attr( $analysis['month_name'] ?? date('F') ); ?>"
                 data-rotation-days="5"
                 data-health-projection="<?php echo esc_attr( json_encode( $variety_params ) ); ?>"
                 data-supplement-dli="<?php echo esc_attr( round( $supplement_dli, 1 ) ); ?>"
                 style="display:none;"></div>
            
            <!-- Coverage Control Slider -->
            <div class="gssh-coverage-control" style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 300px;">
                        <label style="color: #6b7280; font-size: 12px; text-transform: uppercase; display: block; margin-bottom: 8px;">
                            Target Coverage
                        </label>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <input type="range" 
                                   id="gssh-coverage-slider" 
                                   min="10" 
                                   max="100" 
                                   step="5"
                                   value="<?php echo round( ( $analysis['coverage']['coverage_percent'] ?? 30 ) ); ?>"
                                   style="flex: 1; height: 8px; accent-color: #9333ea; cursor: pointer;"
                                   oninput="if(window.gsshUpdateCoverage) window.gsshUpdateCoverage(this.value);"
                                   onchange="if(window.gsshUpdateCoverage) window.gsshUpdateCoverage(this.value);"
                            />
                            <span id="gssh-coverage-value" style="color: #7c3aed; font-weight: bold; font-size: 18px; min-width: 50px;">
                                <?php echo round( $analysis['coverage']['coverage_percent'] ?? 30 ); ?>%
                            </span>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 20px;">
                        <div style="text-align: center; padding: 10px 20px; background: #f1f5f9; border-radius: 6px;">
                            <div style="color: #4b5563; font-size: 10px; text-transform: uppercase;">Rigs Needed</div>
                            <div id="gssh-rigs-needed" style="color: #22c55e; font-weight: bold; font-size: 24px;">
                                <?php echo $current_rigs; ?>
                            </div>
                        </div>
                        <div style="text-align: center; padding: 10px 20px; background: #f1f5f9; border-radius: 6px;">
                            <div style="color: #4b5563; font-size: 10px; text-transform: uppercase;">Area Covered</div>
                            <div id="gssh-area-covered" style="color: #60a5fa; font-weight: bold; font-size: 24px;">
                                <?php echo number_format( $current_rigs * $rig_coverage ); ?>m²
                            </div>
                        </div>
                        <div style="text-align: center; padding: 10px 20px; background: #f1f5f9; border-radius: 6px;">
                            <div style="color: #4b5563; font-size: 10px; text-transform: uppercase;">Est. Health</div>
                            <div id="gssh-est-health" style="color: #eab308; font-weight: bold; font-size: 24px;">
                                <?php echo round( $analysis['health_projection']['with_supplement']['final_health'] ?? 50 ); ?>%
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button type="button" class="gssh-coverage-preset" data-coverage="30"
                            onclick="if(window.gsshUpdateCoverage){document.getElementById('gssh-coverage-slider').value=30;window.gsshUpdateCoverage(30);}"
                            style="padding: 6px 12px; background: #374151; border: 1px solid #4b5563; border-radius: 4px; color: #d1d5db; cursor: pointer; font-size: 12px;">
                        30% (Budget)
                    </button>
                    <button type="button" class="gssh-coverage-preset" data-coverage="50"
                            onclick="if(window.gsshUpdateCoverage){document.getElementById('gssh-coverage-slider').value=50;window.gsshUpdateCoverage(50);}"
                            style="padding: 6px 12px; background: #374151; border: 1px solid #4b5563; border-radius: 4px; color: #d1d5db; cursor: pointer; font-size: 12px;">
                        50% (Standard)
                    </button>
                    <button type="button" class="gssh-coverage-preset" data-coverage="75"
                            onclick="if(window.gsshUpdateCoverage){document.getElementById('gssh-coverage-slider').value=75;window.gsshUpdateCoverage(75);}"
                            style="padding: 6px 12px; background: #374151; border: 1px solid #4b5563; border-radius: 4px; color: #d1d5db; cursor: pointer; font-size: 12px;">
                        75% (Optimal)
                    </button>
                    <button type="button" class="gssh-coverage-preset" data-coverage="100"
                            onclick="if(window.gsshUpdateCoverage){document.getElementById('gssh-coverage-slider').value=100;window.gsshUpdateCoverage(100);}"
                            style="padding: 6px 12px; background: #374151; border: 1px solid #4b5563; border-radius: 4px; color: #d1d5db; cursor: pointer; font-size: 12px;">
                        100% (Full)
                    </button>
                </div>
            </div>
            
            <!-- Dynamic Rotation Schedule - updates when slider changes -->
            <div id="gssh-dynamic-rotation" class="gssh-rotation-schedule" style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; display: none;">
                <h4 style="color: #111827; margin: 0 0 12px; font-size: 14px;">🔄 Rig Rotation Schedule</h4>
                <div id="gssh-rotation-content" style="color: #6b7280; font-size: 13px;">
                    <!-- Populated by JavaScript -->
                </div>
            </div>
            <?php endif; ?>
            
            <!-- Placement visualisation -->
            <div class="gssh-placement-viz" style="margin-bottom: 20px;">
                <?php echo $this->generate_placement_visualisation( $analysis, [
                    'width'  => 900,
                    'height' => 650,
                    'animate_rigs' => true,
                ]); ?>
            </div>
            
            <!-- Health trajectory -->
            <div class="gssh-health-trajectory" id="gssh-health-trajectory-container" style="margin-bottom: 20px;">
                <?php echo $this->generate_health_trajectory_chart( $analysis['health_projection'], [
                    'width'  => 900,
                    'height' => 300,
                ]); ?>
            </div>
            
            <!-- Detailed rig table -->
            <div class="gssh-rig-details" style="background: #f8fafc; padding: 20px; border-radius: 8px;">
                <h4 style="color: #111827; margin: 0 0 15px;">Rig Placement Details</h4>
                <table style="width: 100%; border-collapse: collapse; color: #6b7280; font-size: 13px;">
                    <thead>
                        <tr style="border-bottom: 1px solid #404040;">
                            <th style="text-align: left; padding: 8px;">Priority</th>
                            <th style="text-align: left; padding: 8px;">Rig ID</th>
                            <th style="text-align: center; padding: 8px;">Position (X, Y)</th>
                            <th style="text-align: center; padding: 8px;">Deficit</th>
                            <th style="text-align: center; padding: 8px;">Hours/Day</th>
                            <th style="text-align: center; padding: 8px;">Status</th>
                        </tr>
                    </thead>
                    <tbody id="gssh-rig-table-body">
                        <?php foreach ( $analysis['placements']['rigs'] as $rig ) : 
                            $has_warning = ! ( $rig['can_meet_deficit'] ?? true );
                        ?>
                            <tr style="border-bottom: 1px solid #333;">
                                <td style="padding: 8px;">
                                    <span style="display: inline-block; width: 24px; height: 24px; 
                                                 background: #1e40af; border-radius: 50%; 
                                                 text-align: center; line-height: 24px; color: #111827;">
                                        <?php echo $rig['priority']; ?>
                                    </span>
                                </td>
                                <td style="padding: 8px; color: #9333ea; font-weight: bold;">
                                    <?php echo esc_html( strtoupper( $rig['rig_id'] ) ); ?>
                                </td>
                                <td style="padding: 8px; text-align: center;">
                                    (<?php echo round( $rig['position']['x'] ); ?>m, <?php echo round( $rig['position']['y'] ); ?>m)
                                </td>
                                <td style="padding: 8px; text-align: center; color: #eab308;">
                                    <?php echo $rig['deficit_addressed'] ?? '—'; ?> mol
                                </td>
                                <td style="padding: 8px; text-align: center; color: #60a5fa; font-weight: bold;">
                                    <?php echo $rig['hours_needed_daily'] ?? '—'; ?>h
                                </td>
                                <td style="padding: 8px; text-align: center;">
                                    <?php if ( $has_warning ) : ?>
                                        <span style="color: #ef4444;" title="Shortfall: <?php echo $rig['daily_shortfall'] ?? 0; ?> mol/day">
                                            ⚠️ -<?php echo $rig['daily_shortfall'] ?? 0; ?> mol
                                        </span>
                                    <?php else : ?>
                                        <span style="color: #22c55e;">✓ OK</span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                
                <?php if ( isset( $analysis['placements']['rig_spec'] ) ) : ?>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #404040; font-size: 12px; color: #4b5563;">
                    <strong>Rig Output:</strong> <?php echo $analysis['placements']['rig_spec']['mol_per_hour']; ?> mol/m²/hour | 
                    <strong>Max Hours:</strong> <?php echo $analysis['placements']['rig_spec']['max_daily_hours']; ?>h/day | 
                    <strong>Max Daily Output:</strong> <?php echo $analysis['placements']['rig_spec']['max_daily_output']; ?> mol/m²/day
                </div>
                <?php endif; ?>
            </div>
            
        </div>
        
        <!-- Hub Integration: Dispatch shade data event -->
        <script>
        (function() {
            var shadeData = {
                venue_id: <?php echo json_encode( $analysis['venue_id'] ?? '' ); ?>,
                venue_name: <?php echo json_encode( $analysis['venue_name'] ?? '' ); ?>,
                variety: <?php echo json_encode( $analysis['variety'] ?? '' ); ?>,
                month: <?php echo intval( $analysis['analysis_month'] ?? date('n') ); ?>,
                month_name: <?php echo json_encode( $analysis['analysis_month_name'] ?? '' ); ?>,
                
                // DLI values
                ambient_dli: <?php echo floatval( $analysis['ambient_dli']['dli'] ?? 0 ); ?>,
                target_dli: <?php echo floatval( $analysis['variety_info']['target_dli'] ?? 0 ); ?>,
                minimum_dli: <?php echo floatval( $analysis['variety_info']['minimum_dli'] ?? 0 ); ?>,
                shaded_dli: <?php echo floatval( $analysis['shade_analysis']['shaded_dli'] ?? 0 ); ?>,
                
                // Deficit metrics
                deficit_pct: <?php echo floatval( $analysis['summary']['field_deficit'] ?? $analysis['summary']['total_deficit_pct'] ?? 0 ); ?>,
                deficit_area_pct: <?php echo floatval( ($analysis['deficit_zones']['total_deficit_area'] ?? 0) / (($analysis['shade_analysis']['field_dims']['width'] ?? 68) * ($analysis['shade_analysis']['field_dims']['length'] ?? 105)) * 100 ); ?>,
                
                // Shade factor (0-1, higher = more shade)
                shade_factor: <?php echo floatval( $analysis['shade_analysis']['shade_factor'] ?? 0 ); ?>,
                
                // Stress level
                stress_status: <?php echo json_encode( $analysis['summary']['urgency'] ?? 'unknown' ); ?>,
                
                // Zone data for disease risk weighting
                worst_zone_deficit: <?php echo floatval( $analysis['placements']['worst_zone_deficit'] ?? $analysis['deficit_zones']['critical_zones'][0]['deficit'] ?? 0 ); ?>,
                critical_zones_count: <?php echo intval( count( $analysis['deficit_zones']['critical_zones'] ?? [] ) ); ?>,
                
                // Hemisphere for seasonal adjustment
                hemisphere: <?php echo json_encode( $analysis['location']['hemisphere'] ?? 'southern' ); ?>,
                
                // Timestamp
                timestamp: Date.now(),
                source: 'stadium_light'
            };
            
            // Store globally for direct access
            window.lastStadiumShade = shadeData;
            
            // Calculate DLI deficit for disease engine format
            if (shadeData.ambient_dli > 0 && shadeData.target_dli > 0) {
                shadeData.dli_deficit_mol = Math.max(0, shadeData.target_dli - shadeData.ambient_dli);
                shadeData.dli_deficit_pct = (shadeData.dli_deficit_mol / shadeData.target_dli) * 100;
            }
            
            // Dispatch event for Hub integration
            console.log('[StadiumLight] Dispatching shade data to Hub:', shadeData);
            document.dispatchEvent(new CustomEvent('gssh:stadiumShadeData', {
                detail: shadeData,
                bubbles: true
            }));
        })();
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Generate seasonal analysis view
     * 
     * Shows monthly breakdown, rotation schedules, and deployment summary.
     * 
     * @param array $analysis Seasonal analysis from calculator
     * @return string HTML
     */
    public function generate_seasonal_analysis_view( array $analysis ): string {
        $summary = $analysis['seasonal_summary'];
        $monthly = $analysis['monthly_analysis'];
        $schedule = $analysis['rotation_schedule'];
        $rig_spec = $analysis['rig_spec'];
        $cost_analysis = $analysis['cost_analysis'] ?? null;
        
        // Variety display name
        $variety_names = [
            'tiftuf'        => 'TifTuf Bermuda',
            'tahoma31'      => 'Tahoma 31 Bermuda',
            'legend'        => 'Legend Couch',
            'wintergreen'   => 'Wintergreen Couch',
            'perennial_rye' => 'Perennial Ryegrass',
            'ryegrass'      => 'Perennial Ryegrass',
            'kikuyu'        => 'Kikuyu',
            'zeon'          => 'Zeon Zoysia',
        ];
        $variety_display = $variety_names[ $analysis['variety'] ] ?? ucwords( str_replace( '_', ' ', $analysis['variety'] ) );
        
        ob_start();
        ?>
        <div class="gssh-seasonal-results">
            
            <!-- Seasonal Summary -->
            <div class="gssh-seasonal-summary" style="background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%); border: 1px solid #bae6fd; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
                <h3 style="color: #111827; margin: 0 0 8px; font-size: 20px;">
                    <?php echo esc_html( $analysis['venue_name'] ); ?> — Seasonal Plan
                </h3>
                <p style="color: #22c55e; font-size: 18px; font-weight: 600; margin: 0 0 20px;">
                    <?php echo esc_html( $summary['summary_text'] ); ?>
                </p>
                
                <!-- Key metrics -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px;">
                    <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="color: #4b5563; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Deployment Period</div>
                        <div style="color: #111827; font-size: 18px; font-weight: bold;"><?php echo esc_html( $summary['deployment_period'] ); ?></div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="color: #4b5563; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Peak Rigs Required</div>
                        <div style="color: #f59e0b; font-size: 24px; font-weight: bold;"><?php echo esc_html( $summary['peak_rigs_required'] ); ?></div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="color: #4b5563; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Rotation Frequency</div>
                        <div style="color: #111827; font-size: 18px; font-weight: bold;"><?php echo esc_html( $summary['rotation_frequency'] ); ?></div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="color: #4b5563; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Total Rig-Days</div>
                        <div style="color: #111827; font-size: 18px; font-weight: bold;"><?php echo number_format( $summary['total_rig_days'] ); ?></div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="color: #4b5563; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Turf Variety</div>
                        <div style="color: #22c55e; font-size: 14px; font-weight: bold;"><?php echo esc_html( $variety_display ); ?></div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="color: #4b5563; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Target DLI</div>
                        <div style="color: #60a5fa; font-size: 18px; font-weight: bold;"><?php echo esc_html( $analysis['target_dli'] ); ?> mol</div>
                    </div>
                </div>
                
                <?php if ( $cost_analysis && $cost_analysis['total_cost'] > 0 ) : ?>
                <!-- Energy Cost Summary -->
                <div style="margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; padding: 16px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                    <div style="text-align: center;">
                        <div style="color: #60a5fa; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">⚡ Total Energy</div>
                        <div style="color: #111827; font-size: 18px; font-weight: bold;"><?php echo number_format( $cost_analysis['total_kwh'] ); ?> kWh</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="color: #60a5fa; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">💰 Season Cost</div>
                        <div style="color: #22c55e; font-size: 24px; font-weight: bold;"><?php echo esc_html( $cost_analysis['total_formatted'] ); ?></div>
                    </div>
                    <div style="text-align: center;">
                        <div style="color: #60a5fa; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">📅 Avg Daily Cost</div>
                        <div style="color: #111827; font-size: 18px; font-weight: bold;"><?php echo esc_html( $cost_analysis['avg_daily_formatted'] ); ?></div>
                    </div>
                    <div style="text-align: center;">
                        <div style="color: #60a5fa; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Rate Used</div>
                        <div style="color: #6b7280; font-size: 14px;"><?php echo esc_html( $cost_analysis['symbol'] . $cost_analysis['elec_rate'] ); ?>/kWh</div>
                    </div>
                </div>
                <?php endif; ?>
                
                <?php if ( ! empty( $summary['critical_months'] ) ) : ?>
                <div style="margin-top: 16px; padding: 12px 16px; background: rgba(239, 68, 68, 0.2); border-left: 4px solid #ef4444; border-radius: 4px;">
                    <strong style="color: #991b1b;">⚠️ Critical attention needed:</strong>
                    <span style="color: #b91c1c;"><?php echo esc_html( implode( ', ', $summary['critical_months'] ) ); ?></span>
                </div>
                <?php endif; ?>
            </div>
            
            <!-- Monthly Analysis Chart -->
            <div class="gssh-monthly-chart" style="background: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
                <h4 style="color: #111827; margin: 0 0 20px; font-size: 16px;">📊 Monthly DLI Analysis</h4>
                
                <div style="display: flex; gap: 8px; align-items: flex-end; height: 200px; padding-bottom: 30px; position: relative;">
                    <?php 
                    $max_dli = max( $analysis['target_dli'], max( array_column( $monthly, 'ambient_dli' ) ) );
                    foreach ( $monthly as $month => $data ) : 
                        $ambient_height = ( $data['ambient_dli'] / $max_dli ) * 160;
                        $target_height = ( $analysis['target_dli'] / $max_dli ) * 160;
                        $gap = max( 0, $target_height - $ambient_height );
                        
                        $severity_colors = [
                            'critical'    => '#ef4444',
                            'severe'      => '#f97316',
                            'significant' => '#eab308',
                            'moderate'    => '#84cc16',
                            'minor'       => '#22c55e',
                            'adequate'    => '#22c55e',
                        ];
                        $gap_color = $severity_colors[ $data['severity'] ] ?? '#666';
                    ?>
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; position: relative;">
                            <!-- Gap bar (what's missing) -->
                            <?php if ( $gap > 0 ) : ?>
                            <div style="width: 80%; height: <?php echo $gap; ?>px; background: <?php echo $gap_color; ?>; opacity: 0.6; border-radius: 4px 4px 0 0;" 
                                 title="DLI Gap: <?php echo $data['dli_gap']; ?> mol/m²/day"></div>
                            <?php endif; ?>
                            
                            <!-- Ambient bar -->
                            <div style="width: 80%; height: <?php echo $ambient_height; ?>px; background: #3b82f6; border-radius: <?php echo $gap > 0 ? '0 0 4px 4px' : '4px'; ?>;" 
                                 title="Ambient DLI: <?php echo $data['ambient_dli']; ?> mol/m²/day"></div>
                            
                            <!-- Month label -->
                            <div style="position: absolute; bottom: -25px; font-size: 11px; color: #6b7280;">
                                <?php echo substr( $data['month_name'], 0, 3 ); ?>
                            </div>
                            
                            <!-- Rigs badge -->
                            <?php if ( $data['rigs_required'] > 0 ) : ?>
                            <div style="position: absolute; top: -20px; background: #ffffff; color: #111827; font-size: 10px; padding: 2px 6px; border-radius: 10px; font-weight: bold;">
                                <?php echo $data['rigs_required']; ?>
                            </div>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                    
                    <!-- Target line -->
                    <div style="position: absolute; left: 0; right: 0; bottom: <?php echo 30 + ( $analysis['target_dli'] / $max_dli ) * 160; ?>px; border-top: 2px dashed #22c55e; opacity: 0.7;">
                        <span style="position: absolute; right: 0; top: -18px; font-size: 10px; color: #22c55e;">Target: <?php echo $analysis['target_dli']; ?></span>
                    </div>
                </div>
                
                <!-- Legend -->
                <div style="display: flex; gap: 20px; margin-top: 20px; font-size: 12px; color: #6b7280;">
                    <div><span style="display: inline-block; width: 12px; height: 12px; background: #3b82f6; border-radius: 2px; margin-right: 6px;"></span>Ambient DLI</div>
                    <div><span style="display: inline-block; width: 12px; height: 12px; background: #ef4444; opacity: 0.6; border-radius: 2px; margin-right: 6px;"></span>DLI Gap (supplementation needed)</div>
                    <div><span style="display: inline-block; width: 12px; height: 12px; background: transparent; border: 2px dashed #22c55e; border-radius: 2px; margin-right: 6px;"></span>Target DLI</div>
                </div>
            </div>
            
            <!-- Monthly Details Table -->
            <div class="gssh-monthly-table" style="background: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
                <h4 style="color: #111827; margin: 0 0 16px; font-size: 16px;">📅 Monthly Requirements</h4>
                
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="border-bottom: 2px solid #404040;">
                                <th style="text-align: left; padding: 12px 8px; color: #6b7280;">Month</th>
                                <th style="text-align: center; padding: 12px 8px; color: #6b7280;">Ambient DLI</th>
                                <th style="text-align: center; padding: 12px 8px; color: #6b7280;">DLI Gap</th>
                                <th style="text-align: center; padding: 12px 8px; color: #6b7280;">Severity</th>
                                <th style="text-align: center; padding: 12px 8px; color: #6b7280;">Rigs</th>
                                <th style="text-align: center; padding: 12px 8px; color: #6b7280;">Hours/Day</th>
                                <th style="text-align: center; padding: 12px 8px; color: #6b7280;">Rotations</th>
                                <th style="text-align: left; padding: 12px 8px; color: #6b7280;">Recommendation</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ( $monthly as $month => $data ) : 
                                $severity_badges = [
                                    'critical'    => '<span style="background: #ef4444; color: #111827; padding: 2px 8px; border-radius: 10px; font-size: 11px;">CRITICAL</span>',
                                    'severe'      => '<span style="background: #f97316; color: #111827; padding: 2px 8px; border-radius: 10px; font-size: 11px;">SEVERE</span>',
                                    'significant' => '<span style="background: #eab308; color: #000; padding: 2px 8px; border-radius: 10px; font-size: 11px;">SIGNIFICANT</span>',
                                    'moderate'    => '<span style="background: #84cc16; color: #000; padding: 2px 8px; border-radius: 10px; font-size: 11px;">MODERATE</span>',
                                    'minor'       => '<span style="background: #22c55e; color: #000; padding: 2px 8px; border-radius: 10px; font-size: 11px;">MINOR</span>',
                                    'adequate'    => '<span style="background: #166534; color: #111827; padding: 2px 8px; border-radius: 10px; font-size: 11px;">OK</span>',
                                ];
                            ?>
                            <tr style="border-bottom: 1px solid #404040;">
                                <td style="padding: 12px 8px; color: #111827; font-weight: 500;"><?php echo esc_html( $data['month_name'] ); ?></td>
                                <td style="padding: 12px 8px; text-align: center; color: #60a5fa;"><?php echo esc_html( $data['ambient_dli'] ); ?></td>
                                <td style="padding: 12px 8px; text-align: center; color: <?php echo $data['dli_gap'] > 0 ? '#f87171' : '#22c55e'; ?>;">
                                    <?php echo $data['dli_gap'] > 0 ? '-' . $data['dli_gap'] : '—'; ?>
                                </td>
                                <td style="padding: 12px 8px; text-align: center;"><?php echo $severity_badges[ $data['severity'] ] ?? ''; ?></td>
                                <td style="padding: 12px 8px; text-align: center; color: #111827; font-weight: bold;"><?php echo esc_html( $data['rigs_required'] ); ?></td>
                                <td style="padding: 12px 8px; text-align: center; color: #6b7280;"><?php echo $data['rig_hours_per_day'] > 0 ? round( $data['rig_hours_per_day'], 1 ) . 'h' : '—'; ?></td>
                                <td style="padding: 12px 8px; text-align: center; color: #6b7280;"><?php echo esc_html( $data['rotations_in_month'] ); ?></td>
                                <td style="padding: 12px 8px; color: #6b7280; font-size: 12px;"><?php echo esc_html( $data['recommendation'] ); ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Rotation Schedule (Seasonal Overview - based on minimum rigs per month) -->
            <div class="gssh-rotation-schedule" style="background: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
                <h4 style="color: #111827; margin: 0 0 8px; font-size: 16px;">🔄 Seasonal Rotation Overview</h4>
                <p style="color: #6b7280; font-size: 12px; margin: 0 0 16px;">
                    Based on minimum rigs needed each month. Use the coverage slider in the Rig Calculator results for dynamic scheduling.
                </p>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                    <?php foreach ( $schedule as $month => $month_schedule ) : 
                        if ( empty( $month_schedule['rotations'] ) ) continue;
                        
                        // Check if positions actually vary
                        $unique_positions = [];
                        foreach ( $month_schedule['rotations'] as $rotation ) {
                            foreach ( $rotation['placements'] as $p ) {
                                $key = $p['x'] . ',' . $p['y'];
                                $unique_positions[$key] = true;
                            }
                        }
                        $positions_vary = count($unique_positions) > count($month_schedule['rotations'][0]['placements'] ?? []);
                    ?>
                    <div style="background: #f1f5f9; border-radius: 8px; padding: 16px;">
                        <h5 style="color: #22c55e; margin: 0 0 12px; font-size: 14px;">
                            <?php echo esc_html( $month_schedule['month_name'] ); ?>
                            <?php if ( $positions_vary ) : ?>
                            <span style="color: #4b5563; font-weight: normal;">(<?php echo $month_schedule['total_rotations']; ?> rotations)</span>
                            <?php endif; ?>
                        </h5>
                        
                        <?php if ( ! $positions_vary ) : ?>
                        <!-- Positions don't change - show simplified view -->
                        <div style="color: #6b7280; font-size: 12px; margin-bottom: 8px;">
                            Continuous coverage (positions constant):
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                            <?php foreach ( ($month_schedule['rotations'][0]['placements'] ?? []) as $placement ) : ?>
                            <span style="background: #3b82f6; color: #111827; padding: 2px 8px; border-radius: 4px; font-size: 10px;">
                                Rig <?php echo $placement['rig_number']; ?>: (<?php echo $placement['x']; ?>, <?php echo $placement['y']; ?>)
                            </span>
                            <?php endforeach; ?>
                        </div>
                        <?php else : ?>
                        <!-- Positions vary - show full rotation schedule -->
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <?php foreach ( $month_schedule['rotations'] as $rotation ) : ?>
                            <div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; font-size: 12px;">
                                <div style="color: #6b7280; margin-bottom: 6px;">
                                    <strong style="color: #111827;">Rotation <?php echo $rotation['rotation_number']; ?></strong> — 
                                    <?php echo esc_html( $rotation['days'] ); ?>
                                </div>
                                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                    <?php foreach ( $rotation['placements'] as $placement ) : ?>
                                    <span style="background: #3b82f6; color: #111827; padding: 2px 8px; border-radius: 4px; font-size: 10px;">
                                        Rig <?php echo $placement['rig_number']; ?>: (<?php echo $placement['x']; ?>, <?php echo $placement['y']; ?>)
                                    </span>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                            <?php endforeach; ?>
                        </div>
                        <?php endif; ?>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
            
            <!-- Equipment Recommendation -->
            <div class="gssh-equipment-rec" style="background: linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%); border: 1px solid #86efac; padding: 24px; border-radius: 12px;">
                <h4 style="color: #111827; margin: 0 0 12px; font-size: 16px;">💡 Equipment Recommendation</h4>
                <p style="color: #6b7280; margin: 0 0 16px; font-size: 14px;">
                    <?php echo esc_html( $summary['equipment_recommendation']['recommendation'] ); ?>
                </p>
                
                <div style="display: flex; gap: 20px;">
                    <?php if ( $summary['equipment_recommendation']['rigs_to_own'] > 0 ) : ?>
                    <div style="background: rgba(255,255,255,0.1); padding: 16px 24px; border-radius: 8px; text-align: center;">
                        <div style="color: #22c55e; font-size: 28px; font-weight: bold;"><?php echo $summary['equipment_recommendation']['rigs_to_own']; ?></div>
                        <div style="color: #6b7280; font-size: 12px;">Rigs to Own</div>
                    </div>
                    <?php endif; ?>
                    
                    <?php if ( $summary['equipment_recommendation']['rigs_to_hire'] > 0 ) : ?>
                    <div style="background: rgba(255,255,255,0.1); padding: 16px 24px; border-radius: 8px; text-align: center;">
                        <div style="color: #f59e0b; font-size: 28px; font-weight: bold;"><?php echo $summary['equipment_recommendation']['rigs_to_hire']; ?></div>
                        <div style="color: #6b7280; font-size: 12px;">Rigs to Hire</div>
                    </div>
                    <?php endif; ?>
                </div>
            </div>
            
        </div>
        <?php
        return ob_get_clean();
    }
}
