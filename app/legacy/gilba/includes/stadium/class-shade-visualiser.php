<?php
/**
 * Shade Visualisation Engine
 * 
 * Generates visual representations of shadow patterns on playing surfaces.
 * Produces SVG diagrams showing how shade varies across the day and seasons.
 * 
 * @package Gssh_Stadium
 * @version 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-geometry-utils.php';

class Gssh_Shade_Visualiser {
    
    /**
     * Shade engine instance
     */
    private $shade_engine;
    
    /**
     * Default SVG dimensions
     */
    const DEFAULT_WIDTH = 800;
    const DEFAULT_HEIGHT = 600;
    
    /**
     * Colour palette for visualisations
     */
    const COLOURS = [
        'pitch'          => '#4CAF50',    // Bright green for grass
        'pitch_stroke'   => '#2E7D32',    // Medium green outline
        'shadow'         => 'rgba(0,0,0,0.55)',  // Semi-transparent shadow
        'shadow_light'   => 'rgba(0,0,0,0.25)',  // Lighter shadow for partial
        'structure'      => '#616161',    // Medium grey for stands
        'structure_stroke' => '#424242',
        'sun_indicator'  => '#ffcc00',    // Yellow for sun position
        'grid'           => 'rgba(255,255,255,0.3)',
        'text'           => '#ffffff',
        'zone_highlight' => 'rgba(255,0,0,0.3)',
    ];
    
    /**
     * Constructor
     */
    public function __construct( $shade_engine = null ) {
        $this->shade_engine = $shade_engine ?? new Gssh_Shade_Engine();
    }
    
    /**
     * Generate a single snapshot SVG showing shadows at a specific time
     * 
     * @param string $venue_id    Stadium identifier
     * @param string $datetime    ISO datetime
     * @param array  $options     Display options
     * @return string SVG markup
     */
    public function generate_snapshot( string $venue_id, string $datetime, array $options = [] ): string {
        
        $stadium = Gssh_Stadium_Database::get_stadium( $venue_id );
        if ( ! $stadium ) {
            return $this->generate_error_svg( 'Stadium not found: ' . $venue_id );
        }
        
        $location = Gssh_Stadium_Database::get_location( $venue_id );
        $structures = Gssh_Stadium_Database::get_structures( $venue_id );
        $field = $stadium['field'];
        
        // Get sun position
        $sun_position = $this->shade_engine->get_sun_position( $location, $datetime );
        
        // Calculate shadows for each structure
        $shadows = [];
        foreach ( $structures as $structure ) {
            // Skip roof/truss structures - they're elevated and don't cast ground-level shadows
            if ( ( $structure['type'] ?? '' ) === 'roof' ) continue;
            if ( $sun_position['elevation'] > 0 ) {
                $shadow = $this->shade_engine->calculate_shadow_projection( $structure, $sun_position );
                $shadows[] = [
                    'structure' => $structure,
                    'shadow'    => $shadow,
                ];
            }
        }
        
        // Generate SVG
        return $this->render_snapshot_svg( $stadium, $field, $structures, $shadows, $sun_position, $datetime, $options );
    }
    
    /**
     * Generate animated SVG showing shadow movement through the day
     * 
     * @param string $venue_id    Stadium identifier
     * @param string $date        Date in Y-m-d format
     * @param array  $options     Display options
     * @return string SVG markup with CSS animations
     */
    public function generate_daily_animation( string $venue_id, string $date, array $options = [] ): string {
        
        $stadium = Gssh_Stadium_Database::get_stadium( $venue_id );
        if ( ! $stadium ) {
            return $this->generate_error_svg( 'Stadium not found: ' . $venue_id );
        }
        
        $location = Gssh_Stadium_Database::get_location( $venue_id );
        $structures = Gssh_Stadium_Database::get_structures( $venue_id );
        $field = $stadium['field'];
        
        // Get sun path for the day
        $sun_path = $this->shade_engine->get_sun_path( $location, $date );
        
        // Calculate shadows at each time step
        $frames = [];
        foreach ( $sun_path['path'] as $point ) {
            if ( $point['elevation'] <= 0 ) {
                continue;
            }
            
            $frame_shadows = [];
            foreach ( $structures as $structure ) {
                // Skip roof/truss structures
                if ( ( $structure['type'] ?? '' ) === 'roof' ) continue;
                $shadow = $this->shade_engine->calculate_shadow_projection( $structure, [
                    'azimuth'   => $point['azimuth'],
                    'elevation' => $point['elevation'],
                ]);
                $frame_shadows[] = [
                    'structure' => $structure,
                    'shadow'    => $shadow,
                ];
            }
            
            $frames[] = [
                'time'      => $point['time'],
                'sun'       => $point,
                'shadows'   => $frame_shadows,
            ];
        }
        
        return $this->render_animated_svg( $stadium, $field, $structures, $frames, $sun_path, $date, $options );
    }
    
    /**
     * Generate a grid of snapshots showing shadows at key times
     * 
     * @param string $venue_id    Stadium identifier  
     * @param string $date        Date in Y-m-d format
     * @param array  $times       Array of times (H:i format), or null for default
     * @param array  $options     Display options
     * @return string HTML with multiple SVGs
     */
    public function generate_time_series( string $venue_id, string $date, ?array $times = null, array $options = [] ): string {
        
        $stadium = Gssh_Stadium_Database::get_stadium( $venue_id );
        if ( ! $stadium ) {
            return '<div class="gssh-shade-error">Stadium not found</div>';
        }
        
        $location = Gssh_Stadium_Database::get_location( $venue_id );
        $sun_path = $this->shade_engine->get_sun_path( $location, $date );
        
        // Default times: sunrise, mid-morning, noon, mid-afternoon, sunset
        if ( $times === null ) {
            $times = $this->calculate_key_times( $sun_path );
        }
        
        $html = '<div class="gssh-shade-series">';
        $html .= '<h3 style="color: #111; margin: 0 0 12px; font-size: 15px;">' . esc_html( $stadium['name'] ) . ' - ' . esc_html( date( 'j F Y', strtotime( $date ) ) ) . '</h3>';
        $html .= '<div class="gssh-shade-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:8px;">';
        
        foreach ( $times as $time ) {
            $datetime = $date . 'T' . $time . ':00';
            $svg = $this->generate_snapshot( $venue_id, $datetime, array_merge( $options, [
                'width'      => 350,
                'height'     => 280,
                'show_title' => true,
                'title'      => $time,
                'compact'    => true,
            ]));
            
            $html .= '<div class="gssh-shade-frame">' . $svg . '</div>';
        }
        
        $html .= '</div></div>';
        
        return $html;
    }
    
    /**
     * Generate seasonal comparison showing same time on different dates
     * 
     * @param string $venue_id    Stadium identifier
     * @param string $time        Time of day (H:i format)
     * @param int    $year        Year for dates
     * @param array  $options     Display options
     * @return string HTML with SVGs for each season
     */
    public function generate_seasonal_comparison( string $venue_id, string $time = '12:00', int $year = null, array $options = [] ): string {
        
        $year = $year ?? (int) date( 'Y' );
        
        // Key dates for Southern Hemisphere
        $dates = [
            'Summer Solstice'  => $year . '-12-21',
            'Autumn Equinox'   => $year . '-03-21',
            'Winter Solstice'  => $year . '-06-21',
            'Spring Equinox'   => $year . '-09-21',
        ];
        
        $stadium = Gssh_Stadium_Database::get_stadium( $venue_id );
        if ( ! $stadium ) {
            return '<div class="gssh-shade-error">Stadium not found</div>';
        }
        
        $html = '<div class="gssh-shade-seasonal">';
        $html .= '<h3 style="margin:0 0 12px;font-size:15px;">' . esc_html( $stadium['name'] ) . ' - Seasonal Shadow Comparison at ' . esc_html( $time ) . '</h3>';
        $html .= '<div class="gssh-shade-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
        
        foreach ( $dates as $label => $date ) {
            $datetime = $date . 'T' . $time . ':00';
            $svg = $this->generate_snapshot( $venue_id, $datetime, array_merge( $options, [
                'width'      => 420,
                'height'     => 340,
                'show_title' => true,
                'title'      => $label,
                'subtitle'   => date( 'j M', strtotime( $date ) ),
                'compact'    => true,
            ]));
            
            $html .= '<div class="gssh-shade-frame">' . $svg . '</div>';
        }
        
        $html .= '</div></div>';
        
        return $html;
    }
    
    /**
     * Generate cumulative shade map showing total daily shade hours per zone
     * 
     * @param string $venue_id    Stadium identifier
     * @param string $date        Date in Y-m-d format
     * @param array  $options     Display options
     * @return string SVG with heatmap overlay
     */
    public function generate_shade_heatmap( string $venue_id, string $date, array $options = [] ): string {
        
        $stadium = Gssh_Stadium_Database::get_stadium( $venue_id );
        if ( ! $stadium ) {
            return $this->generate_error_svg( 'Stadium not found' );
        }
        
        $location = Gssh_Stadium_Database::get_location( $venue_id );
        $structures = Gssh_Stadium_Database::get_structures( $venue_id );
        $field = $stadium['field'];
        $sun_path = $this->shade_engine->get_sun_path( $location, $date );
        
        // Create grid of sample points across the field
        $resolution = $options['resolution'] ?? 5;  // metres per cell
        $shade_grid = $this->calculate_shade_grid( $field, $structures, $location, $sun_path, $resolution );
        
        return $this->render_heatmap_svg( $stadium, $field, $shade_grid, $sun_path, $date, $options );
    }
    
    // =========================================================================
    // PRIVATE RENDERING METHODS
    // =========================================================================
    
    /**
     * Render a single snapshot SVG
     */
    private function render_snapshot_svg( 
        array $stadium, 
        array $field, 
        array $structures, 
        array $shadows,
        array $sun_position,
        string $datetime,
        array $options 
    ): string {
        
        $width = $options['width'] ?? self::DEFAULT_WIDTH;
        $height = $options['height'] ?? self::DEFAULT_HEIGHT;
        $padding = $options['padding'] ?? 40;
        $compact = $options['compact'] ?? false;
        
        // Calculate scale to fit field in SVG
        $field_length = $field['length'] ?? 165;
        $field_width = $field['width'] ?? 135;
        
        $available_width = $width - ( $padding * 2 );
        $available_height = $height - ( $padding * 2 ) - ( $compact ? 20 : 60 );
        
        $scale_x = $available_width / ( $field_length + 40 );  // Extra space for structures
        $scale_y = $available_height / ( $field_width + 40 );
        $scale = min( $scale_x, $scale_y );
        
        // Centre point
        $cx = $width / 2;
        $cy = $height / 2 + ( $compact ? 0 : 15 );
        
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' . $width . ' ' . $height . '" ';
        $svg .= 'width="' . $width . '" height="' . $height . '" class="gssh-shade-snapshot">';
        
        // Background
        $svg .= '<rect width="100%" height="100%" fill="#2d2d2d"/>';
        
        // Title
        if ( ! empty( $options['show_title'] ) ) {
            $title = $options['title'] ?? date( 'H:i', strtotime( $datetime ) );
            $svg .= '<text x="' . $cx . '" y="' . ( $compact ? 15 : 25 ) . '" ';
            $svg .= 'text-anchor="middle" fill="' . self::COLOURS['text'] . '" ';
            $svg .= 'font-family="Arial, sans-serif" font-size="' . ( $compact ? 12 : 16 ) . '" font-weight="bold">';
            $svg .= esc_html( $title ) . '</text>';
            
            if ( ! empty( $options['subtitle'] ) ) {
                $svg .= '<text x="' . $cx . '" y="' . ( $compact ? 28 : 42 ) . '" ';
                $svg .= 'text-anchor="middle" fill="' . self::COLOURS['text'] . '" ';
                $svg .= 'font-family="Arial, sans-serif" font-size="' . ( $compact ? 10 : 12 ) . '" opacity="0.7">';
                $svg .= esc_html( $options['subtitle'] ) . '</text>';
            }
        }
        
        // Field (pitch)
        $svg .= $this->render_field( $field, $cx, $cy, $scale );
        
        // Shadows (render before structures so they appear behind)
        foreach ( $shadows as $shadow_data ) {
            if ( ! empty( $shadow_data['shadow']['shadow_polygon'] ) ) {
                $svg .= $this->render_shadow( $shadow_data['shadow'], $cx, $cy, $scale, $shadow_data['structure'] );
            }
        }
        
        // Structures
        foreach ( $structures as $structure ) {
            if ( ( $structure['type'] ?? '' ) === 'roof' ) continue;
            $svg .= $this->render_structure( $structure, $cx, $cy, $scale );
        }
        
        // Sun position indicator
        if ( ! $compact && $sun_position['is_daylight'] ) {
            $svg .= $this->render_sun_indicator( $sun_position, $width, $height, $padding );
        }
        
        // Info panel
        if ( ! $compact ) {
            $svg .= $this->render_info_panel( $stadium, $sun_position, $datetime, $width, $height );
        }
        
        $svg .= '</svg>';
        
        return $svg;
    }
    
    /**
     * Render the playing field
     */
    private function render_field( array $field, float $cx, float $cy, float $scale ): string {
        
        $length = ( $field['length'] ?? 165 ) * $scale;
        $width = ( $field['width'] ?? 135 ) * $scale;
        $type = $field['type'] ?? 'oval';
        
        $svg = '';
        
        if ( $type === 'oval' ) {
            // Oval field
            $svg .= '<ellipse cx="' . $cx . '" cy="' . $cy . '" ';
            $svg .= 'rx="' . ( $length / 2 ) . '" ry="' . ( $width / 2 ) . '" ';
            $svg .= 'fill="' . self::COLOURS['pitch'] . '" ';
            $svg .= 'stroke="' . self::COLOURS['pitch_stroke'] . '" stroke-width="2"/>';
            
            // Centre circle
            $svg .= '<circle cx="' . $cx . '" cy="' . $cy . '" r="' . ( 25 * $scale ) . '" ';
            $svg .= 'fill="none" stroke="' . self::COLOURS['grid'] . '" stroke-width="1"/>';
            
        } else {
            // Rectangular field
            $svg .= '<rect x="' . ( $cx - $length / 2 ) . '" y="' . ( $cy - $width / 2 ) . '" ';
            $svg .= 'width="' . $length . '" height="' . $width . '" ';
            $svg .= 'fill="' . self::COLOURS['pitch'] . '" ';
            $svg .= 'stroke="' . self::COLOURS['pitch_stroke'] . '" stroke-width="2"/>';
            
            // Centre line
            $svg .= '<line x1="' . ( $cx - $length / 2 ) . '" y1="' . $cy . '" ';
            $svg .= 'x2="' . ( $cx + $length / 2 ) . '" y2="' . $cy . '" ';
            $svg .= 'stroke="' . self::COLOURS['grid'] . '" stroke-width="1"/>';
            
            // Centre circle
            $svg .= '<circle cx="' . $cx . '" cy="' . $cy . '" r="' . ( 9.15 * $scale ) . '" ';
            $svg .= 'fill="none" stroke="' . self::COLOURS['grid'] . '" stroke-width="1"/>';
        }
        
        // Centre spot
        $svg .= '<circle cx="' . $cx . '" cy="' . $cy . '" r="3" fill="' . self::COLOURS['grid'] . '"/>';
        
        return $svg;
    }
    
    /**
     * Render a structure (stand)
     */
    private function render_structure( array $structure, float $cx, float $cy, float $scale ): string {
        
        $x = ( $structure['position']['x'] ?? 0 ) * $scale;
        $y = -( $structure['position']['y'] ?? 0 ) * $scale;  // Flip Y axis
        $w = ( $structure['width'] ?? 20 ) * $scale;
        $d = ( $structure['depth'] ?? 20 ) * $scale;
        
        // For stands, width is along one axis, depth along the other
        // Position is centre of structure
        $sx = $cx + $x - $w / 2;
        $sy = $cy + $y - $d / 2;
        
        $svg = '<rect x="' . $sx . '" y="' . $sy . '" ';
        $svg .= 'width="' . $w . '" height="' . $d . '" ';
        $svg .= 'fill="' . self::COLOURS['structure'] . '" ';
        $svg .= 'stroke="' . self::COLOURS['structure_stroke'] . '" stroke-width="1"/>';
        
        return $svg;
    }
    
    /**
     * Render a shadow polygon
     */
    private function render_shadow( array $shadow, float $cx, float $cy, float $scale, array $structure ): string {
        
        $polygon = $shadow['shadow_polygon'] ?? [];
        if ( empty( $polygon ) ) {
            return '';
        }
        
        $permeability = $structure['permeability'] ?? 0;
        $opacity = 0.6 * ( 1 - $permeability );
        
        $points = [];
        foreach ( $polygon as $point ) {
            $px = $cx + ( $point[0] * $scale );
            $py = $cy - ( $point[1] * $scale );  // Flip Y axis
            $points[] = $px . ',' . $py;
        }
        
        $svg = '<polygon points="' . implode( ' ', $points ) . '" ';
        $svg .= 'fill="rgba(0,0,0,' . $opacity . ')" ';
        $svg .= 'stroke="none"/>';
        
        return $svg;
    }
    
    /**
     * Render sun position indicator
     */
    private function render_sun_indicator( array $sun_position, float $width, float $height, float $padding ): string {
        
        $azimuth = $sun_position['azimuth'];
        $elevation = $sun_position['elevation'];
        
        // Position sun icon around the edge based on azimuth
        $radius = min( $width, $height ) / 2 - $padding;
        $angle = deg2rad( $azimuth - 90 );  // Convert to SVG coordinates
        
        $sx = $width / 2 + $radius * 0.9 * cos( $angle );
        $sy = $height / 2 + $radius * 0.9 * sin( $angle );
        
        $svg = '<g class="sun-indicator">';
        
        // Sun icon
        $svg .= '<circle cx="' . $sx . '" cy="' . $sy . '" r="12" ';
        $svg .= 'fill="' . self::COLOURS['sun_indicator'] . '"/>';
        
        // Rays
        for ( $i = 0; $i < 8; $i++ ) {
            $ray_angle = deg2rad( $i * 45 );
            $x1 = $sx + 14 * cos( $ray_angle );
            $y1 = $sy + 14 * sin( $ray_angle );
            $x2 = $sx + 20 * cos( $ray_angle );
            $y2 = $sy + 20 * sin( $ray_angle );
            $svg .= '<line x1="' . $x1 . '" y1="' . $y1 . '" x2="' . $x2 . '" y2="' . $y2 . '" ';
            $svg .= 'stroke="' . self::COLOURS['sun_indicator'] . '" stroke-width="2"/>';
        }
        
        // Elevation label
        $svg .= '<text x="' . $sx . '" y="' . ( $sy + 32 ) . '" ';
        $svg .= 'text-anchor="middle" fill="' . self::COLOURS['text'] . '" ';
        $svg .= 'font-family="Arial, sans-serif" font-size="10">';
        $svg .= round( $elevation ) . '°</text>';
        
        $svg .= '</g>';
        
        return $svg;
    }
    
    /**
     * Render info panel
     */
    private function render_info_panel( array $stadium, array $sun_position, string $datetime, float $width, float $height ): string {
        
        $svg = '<g class="info-panel">';
        
        $y = $height - 25;
        
        // Stadium name
        $svg .= '<text x="10" y="' . $y . '" fill="' . self::COLOURS['text'] . '" ';
        $svg .= 'font-family="Arial, sans-serif" font-size="11" opacity="0.8">';
        $svg .= esc_html( $stadium['name'] );
        $svg .= '</text>';
        
        // Time and sun info
        $time_str = date( 'H:i', strtotime( $datetime ) );
        $sun_str = $sun_position['is_daylight'] 
            ? 'Sun: ' . round( $sun_position['elevation'] ) . '° elev, ' . round( $sun_position['azimuth'] ) . '° az'
            : 'Night';
        
        $svg .= '<text x="' . ( $width - 10 ) . '" y="' . $y . '" text-anchor="end" ';
        $svg .= 'fill="' . self::COLOURS['text'] . '" font-family="Arial, sans-serif" font-size="11" opacity="0.8">';
        $svg .= esc_html( $time_str . ' | ' . $sun_str );
        $svg .= '</text>';
        
        $svg .= '</g>';
        
        return $svg;
    }
    
    /**
     * Render animated SVG with JavaScript animation
     */
    private function render_animated_svg(
        array $stadium,
        array $field,
        array $structures,
        array $frames,
        array $sun_path,
        string $date,
        array $options
    ): string {
        
        $width = $options['width'] ?? self::DEFAULT_WIDTH;
        $height = $options['height'] ?? self::DEFAULT_HEIGHT;
        $duration = $options['duration'] ?? 10;  // seconds for full animation
        $padding = 40;
        
        // Calculate scale
        $field_length = $field['length'] ?? 165;
        $field_width = $field['width'] ?? 135;
        $available_width = $width - ( $padding * 2 );
        $available_height = $height - ( $padding * 2 ) - 80;
        $scale = min( $available_width / ( $field_length + 40 ), $available_height / ( $field_width + 40 ) );
        
        $cx = $width / 2;
        $cy = $height / 2 + 20;
        
        $instance_id = 'shade-anim-' . uniqid();
        $frame_count = count( $frames );
        
        if ( $frame_count === 0 ) {
            return '<div class="gssh-shade-error" style="padding:40px;text-align:center;color:#f87171;">No shadow frames generated for this date/location.</div>';
        }
        
        $html = '<div id="' . esc_attr( $instance_id ) . '-container" class="gssh-shade-animation-container" style="position:relative;">';
        
        // SVG
        $html .= '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' . $width . ' ' . $height . '" ';
        $html .= 'width="' . $width . '" height="' . $height . '" style="max-width:100%;height:auto;" class="gssh-shade-animated" id="' . esc_attr( $instance_id ) . '">';
        
        // Styles
        $html .= '<style>';
        $html .= '.shadow-group { transition: opacity 0.3s ease; }';
        $html .= '</style>';
        
        // Background
        $html .= '<rect width="100%" height="100%" fill="#2d2d2d"/>';
        
        // Title
        $html .= '<text x="' . $cx . '" y="30" text-anchor="middle" fill="' . self::COLOURS['text'] . '" ';
        $html .= 'font-family="Arial, sans-serif" font-size="16" font-weight="bold">';
        $html .= esc_html( $stadium['name'] ) . ' - ' . esc_html( date( 'j F Y', strtotime( $date ) ) );
        $html .= '</text>';
        
        // Time display (updated by JS)
        $html .= '<text id="' . esc_attr( $instance_id ) . '-time" x="' . $cx . '" y="50" text-anchor="middle" fill="#fbbf24" ';
        $html .= 'font-family="Arial, sans-serif" font-size="18" font-weight="bold">';
        $html .= esc_html( $frames[0]['time'] ?? '12:00' );
        $html .= '</text>';
        
        // Field
        $html .= $this->render_field( $field, $cx, $cy, $scale );
        
        // Shadow frames (all rendered, JS controls visibility)
        foreach ( $frames as $i => $frame ) {
            $opacity = ( $i === 0 ) ? '1' : '0';
            $html .= '<g class="shadow-group" id="' . esc_attr( $instance_id ) . '-frame-' . $i . '" style="opacity:' . $opacity . ';" data-time="' . esc_attr( $frame['time'] ) . '">';
            
            foreach ( $frame['shadows'] as $shadow_data ) {
                if ( ! empty( $shadow_data['shadow']['shadow_polygon'] ) ) {
                    $html .= $this->render_shadow( $shadow_data['shadow'], $cx, $cy, $scale, $shadow_data['structure'] );
                }
            }
            
            $html .= '</g>';
        }
        
        // Structures (always visible)
        foreach ( $structures as $structure ) {
            if ( ( $structure['type'] ?? '' ) === 'roof' ) continue;
            $html .= $this->render_structure( $structure, $cx, $cy, $scale );
        }
        
        // Day info
        $html .= '<text x="' . $cx . '" y="' . ( $height - 15 ) . '" text-anchor="middle" ';
        $html .= 'fill="' . self::COLOURS['text'] . '" font-family="Arial, sans-serif" font-size="11" opacity="0.7">';
        $html .= 'Sunrise: ' . esc_html( $sun_path['sunrise'] ?? 'N/A' ) . ' | ';
        $html .= 'Sunset: ' . esc_html( $sun_path['sunset'] ?? 'N/A' ) . ' | ';
        $html .= 'Day length: ' . esc_html( round( $sun_path['day_length'] ?? 0, 1 ) ) . 'h';
        $html .= '</text>';
        
        $html .= '</svg>';
        
        // Playback controls
        $html .= '<div style="display:flex;align-items:center;justify-content:center;gap:15px;padding:15px;background:#27272a;border-radius:0 0 8px 8px;">';
        $html .= '<button type="button" id="' . esc_attr( $instance_id ) . '-play" style="padding:8px 20px;background:#22c55e;color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:600;">▶ Play</button>';
        $html .= '<button type="button" id="' . esc_attr( $instance_id ) . '-pause" style="padding:8px 20px;background:#ef4444;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;display:none;">⏸ Pause</button>';
        $html .= '<input type="range" id="' . esc_attr( $instance_id ) . '-slider" min="0" max="' . ( $frame_count - 1 ) . '" value="0" style="flex:1;max-width:300px;">';
        $html .= '<span id="' . esc_attr( $instance_id ) . '-frame-label" style="color:#a1a1aa;font-size:13px;min-width:80px;">Frame 1/' . $frame_count . '</span>';
        $html .= '</div>';
        
        $html .= '</div>';
        
        // JavaScript animation controller
        $html .= '<script>
(function() {
    var containerId = "' . esc_js( $instance_id ) . '";
    var frameCount = ' . $frame_count . ';
    var currentFrame = 0;
    var isPlaying = false;
    var intervalId = null;
    var frameDelay = ' . round( ( $duration * 1000 ) / $frame_count ) . '; // ms per frame
    
    var timeDisplay = document.getElementById(containerId + "-time");
    var playBtn = document.getElementById(containerId + "-play");
    var pauseBtn = document.getElementById(containerId + "-pause");
    var slider = document.getElementById(containerId + "-slider");
    var frameLabel = document.getElementById(containerId + "-frame-label");
    
    function showFrame(index) {
        for (var i = 0; i < frameCount; i++) {
            var frame = document.getElementById(containerId + "-frame-" + i);
            if (frame) {
                frame.style.opacity = (i === index) ? "1" : "0";
                if (i === index && timeDisplay) {
                    timeDisplay.textContent = frame.dataset.time || "";
                }
            }
        }
        if (slider) slider.value = index;
        if (frameLabel) frameLabel.textContent = "Frame " + (index + 1) + "/" + frameCount;
    }
    
    function play() {
        if (isPlaying) return;
        isPlaying = true;
        if (playBtn) playBtn.style.display = "none";
        if (pauseBtn) pauseBtn.style.display = "inline-block";
        
        intervalId = setInterval(function() {
            currentFrame = (currentFrame + 1) % frameCount;
            showFrame(currentFrame);
        }, frameDelay);
    }
    
    function pause() {
        isPlaying = false;
        if (playBtn) playBtn.style.display = "inline-block";
        if (pauseBtn) pauseBtn.style.display = "none";
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }
    
    if (playBtn) playBtn.addEventListener("click", play);
    if (pauseBtn) pauseBtn.addEventListener("click", pause);
    if (slider) {
        slider.addEventListener("input", function() {
            pause();
            currentFrame = parseInt(this.value);
            showFrame(currentFrame);
        });
    }
    
    // Show first frame
    showFrame(0);
    
    // Auto-play after short delay
    setTimeout(play, 500);
})();
</script>';
        
        return $html;
    }
    
    /**
     * Calculate shade grid for heatmap
     */
    private function calculate_shade_grid( array $field, array $structures, array $location, array $sun_path, float $resolution ): array {
        
        // Use playing surface dimensions if available, otherwise full field
        $length = $field['playing_length'] ?? $field['length'] ?? 165;
        $width = $field['playing_width'] ?? $field['width'] ?? 135;
        
        $grid = [];
        $daylight_hours = $sun_path['day_length'];
        
        // Sample points across field
        for ( $x = -$length / 2; $x <= $length / 2; $x += $resolution ) {
            for ( $y = -$width / 2; $y <= $width / 2; $y += $resolution ) {
                
                // Check if point is within field boundary (for ovals)
                if ( $field['type'] === 'oval' ) {
                    $normalised = pow( $x / ( $length / 2 ), 2 ) + pow( $y / ( $width / 2 ), 2 );
                    if ( $normalised > 1 ) {
                        continue;
                    }
                }
                
                // Count hours in shade
                $shade_hours = 0;
                $sample_count = 0;
                
                foreach ( $sun_path['path'] as $point ) {
                    if ( $point['elevation'] <= 5 ) {  // Min elevation for shadow calc (Beard 1973)
                        continue;
                    }
                    
                    $sample_count++;
                    $in_shade = false;
                    
                    foreach ( $structures as $structure ) {
                        // Skip roof/truss structures
                        if ( ( $structure['type'] ?? '' ) === 'roof' ) continue;
                        $shadow = $this->shade_engine->calculate_shadow_projection( $structure, [
                            'azimuth'   => $point['azimuth'],
                            'elevation' => $point['elevation'],
                        ]);
                        
                        if ( $this->point_in_shadow( $x, $y, $shadow, $structure ) ) {
                            $in_shade = true;
                            break;
                        }
                    }
                    
                    if ( $in_shade ) {
                        $shade_hours += 0.5;  // 30-minute intervals
                    }
                }
                
                $grid[] = [
                    'x'           => $x,
                    'y'           => $y,
                    'shade_hours' => $shade_hours,
                    'shade_pct'   => $daylight_hours > 0 ? ( $shade_hours / $daylight_hours ) * 100 : 0,
                ];
            }
        }
        
        return $grid;
    }
    
    /**
     * Check if a point is within a shadow polygon
     */
    private function point_in_shadow( float $px, float $py, array $shadow, array $structure ): bool {
        
        $polygon = $shadow['shadow_polygon'] ?? [];
        if ( empty( $polygon ) ) {
            return false;
        }
        
        // Use geometry utils for robust point-in-polygon test
        $inside = Gssh_Geometry_Utils::point_in_polygon( [ $px, $py ], $polygon );
        
        // Account for permeability deterministically
        if ( $inside && isset( $structure['permeability'] ) ) {
            // For heatmap: permeability >= 0.5 means mostly transmissive, treat as not shaded
            // Below 0.5: treat as shaded (conservative for turf management)
            return $structure['permeability'] < 0.5;
        }
        
        return $inside;
    }
    
    /**
     * Render heatmap SVG
     */
    private function render_heatmap_svg( array $stadium, array $field, array $grid, array $sun_path, string $date, array $options ): string {
        
        $width = $options['width'] ?? self::DEFAULT_WIDTH;
        $height = $options['height'] ?? self::DEFAULT_HEIGHT;
        $padding = 40;
        
        $field_length = $field['length'] ?? 165;
        $field_width = $field['width'] ?? 135;
        $available_width = $width - ( $padding * 2 );
        $available_height = $height - ( $padding * 2 ) - 100;
        $scale = min( $available_width / ( $field_length + 20 ), $available_height / ( $field_width + 20 ) );
        
        $cx = $width / 2;
        $cy = $height / 2;
        
        $resolution = $options['resolution'] ?? 5;
        $cell_size = $resolution * $scale;
        
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' . $width . ' ' . $height . '" ';
        $svg .= 'width="' . $width . '" height="' . $height . '" class="gssh-shade-heatmap">';
        
        // Background
        $svg .= '<rect width="100%" height="100%" fill="#2d2d2d"/>';
        
        // Title
        $svg .= '<text x="' . $cx . '" y="25" text-anchor="middle" fill="' . self::COLOURS['text'] . '" ';
        $svg .= 'font-family="Arial, sans-serif" font-size="16" font-weight="bold">';
        $svg .= esc_html( $stadium['name'] ) . ' - Daily Shade Accumulation';
        $svg .= '</text>';
        $svg .= '<text x="' . $cx . '" y="42" text-anchor="middle" fill="' . self::COLOURS['text'] . '" ';
        $svg .= 'font-family="Arial, sans-serif" font-size="12" opacity="0.7">';
        $svg .= esc_html( date( 'j F Y', strtotime( $date ) ) );
        $svg .= '</text>';
        
        // Field outline
        $svg .= $this->render_field( $field, $cx, $cy, $scale );
        
        // Heatmap cells
        foreach ( $grid as $cell ) {
            $px = $cx + ( $cell['x'] * $scale );
            $py = $cy - ( $cell['y'] * $scale );
            
            // Colour based on shade percentage (green = full sun, red = heavy shade)
            $shade_pct = min( 100, $cell['shade_pct'] );
            $colour = $this->shade_percentage_to_colour( $shade_pct );
            
            $svg .= '<rect x="' . ( $px - $cell_size / 2 ) . '" y="' . ( $py - $cell_size / 2 ) . '" ';
            $svg .= 'width="' . $cell_size . '" height="' . $cell_size . '" ';
            $svg .= 'fill="' . $colour . '" opacity="0.7"/>';
        }
        
        // Legend
        $svg .= $this->render_heatmap_legend( $width, $height );
        
        // Info
        $svg .= '<text x="' . $cx . '" y="' . ( $height - 15 ) . '" text-anchor="middle" ';
        $svg .= 'fill="' . self::COLOURS['text'] . '" font-family="Arial, sans-serif" font-size="11" opacity="0.7">';
        $svg .= 'Day length: ' . round( $sun_path['day_length'], 1 ) . ' hours | ';
        $svg .= 'Max sun elevation: ' . round( $sun_path['max_elevation'] ) . '°';
        $svg .= '</text>';
        
        $svg .= '</svg>';
        
        return $svg;
    }
    
    /**
     * Convert shade percentage to colour (green->yellow->red gradient)
     */
    private function shade_percentage_to_colour( float $pct ): string {
        
        // 0% shade = green (full sun)
        // 50% shade = yellow
        // 100% shade = red
        
        if ( $pct <= 50 ) {
            // Green to yellow
            $r = round( 255 * ( $pct / 50 ) );
            $g = 200;
            $b = 0;
        } else {
            // Yellow to red
            $r = 255;
            $g = round( 200 * ( 1 - ( $pct - 50 ) / 50 ) );
            $b = 0;
        }
        
        return "rgb($r,$g,$b)";
    }
    
    /**
     * Render heatmap legend
     */
    private function render_heatmap_legend( float $width, float $height ): string {
        
        $legend_width = 200;
        $legend_height = 15;
        $lx = $width - $legend_width - 20;
        $ly = 20;
        
        $svg = '<g class="legend">';
        
        // Gradient bar
        $svg .= '<defs><linearGradient id="shade-gradient" x1="0%" y1="0%" x2="100%" y2="0%">';
        $svg .= '<stop offset="0%" style="stop-color:rgb(0,200,0)"/>';
        $svg .= '<stop offset="50%" style="stop-color:rgb(255,200,0)"/>';
        $svg .= '<stop offset="100%" style="stop-color:rgb(255,0,0)"/>';
        $svg .= '</linearGradient></defs>';
        
        $svg .= '<rect x="' . $lx . '" y="' . $ly . '" width="' . $legend_width . '" height="' . $legend_height . '" ';
        $svg .= 'fill="url(#shade-gradient)" stroke="#666" stroke-width="1"/>';
        
        // Labels
        $svg .= '<text x="' . $lx . '" y="' . ( $ly + $legend_height + 12 ) . '" ';
        $svg .= 'fill="' . self::COLOURS['text'] . '" font-family="Arial, sans-serif" font-size="10">Full sun</text>';
        
        $svg .= '<text x="' . ( $lx + $legend_width ) . '" y="' . ( $ly + $legend_height + 12 ) . '" ';
        $svg .= 'text-anchor="end" fill="' . self::COLOURS['text'] . '" font-family="Arial, sans-serif" font-size="10">Full shade</text>';
        
        $svg .= '</g>';
        
        return $svg;
    }
    
    /**
     * Calculate key times for time series
     */
    private function calculate_key_times( array $sun_path ): array {
        
        $sunrise = $sun_path['sunrise'];
        $sunset = $sun_path['sunset'];
        $noon = $sun_path['solar_noon'];
        
        // Parse times
        $sunrise_mins = $this->time_to_minutes( $sunrise );
        $sunset_mins = $this->time_to_minutes( $sunset );
        $noon_mins = $this->time_to_minutes( $noon );
        
        $times = [
            $this->minutes_to_time( $sunrise_mins + 30 ),                    // Just after sunrise
            $this->minutes_to_time( ( $sunrise_mins + $noon_mins ) / 2 ),    // Mid-morning
            $noon,                                                            // Solar noon
            $this->minutes_to_time( ( $noon_mins + $sunset_mins ) / 2 ),     // Mid-afternoon
            $this->minutes_to_time( $sunset_mins - 30 ),                     // Just before sunset
        ];
        
        return $times;
    }
    
    /**
     * Convert H:i time to minutes
     */
    private function time_to_minutes( string $time ): int {
        $parts = explode( ':', $time );
        return (int) $parts[0] * 60 + (int) $parts[1];
    }
    
    /**
     * Convert minutes to H:i time
     */
    private function minutes_to_time( float $minutes ): string {
        $hours = (int) floor( $minutes / 60 );
        $mins = (int) round( fmod( $minutes, 60 ) );
        return sprintf( '%02d:%02d', $hours, $mins );
    }
    
    /**
     * Generate error SVG
     */
    private function generate_error_svg( string $message ): string {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200">' .
               '<rect width="100%" height="100%" fill="#2a2a2a"/>' .
               '<text x="200" y="100" text-anchor="middle" fill="#ff6666" font-family="Arial" font-size="14">' .
               esc_html( $message ) . '</text></svg>';
    }
}
