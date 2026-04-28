<?php
/**
 * Custom Venue UI
 *
 * Front-end and admin form for creating and editing custom (non-database) venues.
 * Allows users to define stadium geometry, stand heights, and orientation for
 * venues not included in the bundled Gssh_Stadium_Database.
 *
 * @package Gilba_Agronomic_Intelligence_Hub
 * @subpackage Stadium
 * @version 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Custom_Venue_UI {

    /**
     * Render the custom venue creation/edit form.
     *
     * @param array $defaults Pre-fill values (name, lat, lng, orientation, length, width, stands).
     * @return string HTML
     */
    public static function render_form( array $defaults = array() ): string {
        $defaults = wp_parse_args( $defaults, array(
            'name'        => '',
            'lat'         => '',
            'lng'         => '',
            'orientation' => 0,
            'length'      => 105,
            'width'       => 68,
            'stands'      => array(),
        ) );

        $nonce = wp_create_nonce( 'gssh_hub_nonce' );

        ob_start();
        ?>
        <div class="gssh-custom-venue-ui">
            <h4><?php esc_html_e( 'Define Custom Venue', 'gilba-hub' ); ?></h4>

            <div class="gssh-form-row">
                <label><?php esc_html_e( 'Venue Name', 'gilba-hub' ); ?></label>
                <input type="text" id="gssh-custom-name" value="<?php echo esc_attr( $defaults['name'] ); ?>"
                       placeholder="<?php esc_attr_e( 'e.g. Training Ground North', 'gilba-hub' ); ?>">
            </div>

            <div class="gssh-form-row gssh-form-row--split">
                <div>
                    <label><?php esc_html_e( 'Latitude', 'gilba-hub' ); ?></label>
                    <input type="number" id="gssh-custom-lat" step="0.0001"
                           value="<?php echo esc_attr( $defaults['lat'] ); ?>">
                </div>
                <div>
                    <label><?php esc_html_e( 'Longitude', 'gilba-hub' ); ?></label>
                    <input type="number" id="gssh-custom-lng" step="0.0001"
                           value="<?php echo esc_attr( $defaults['lng'] ); ?>">
                </div>
            </div>

            <div class="gssh-form-row gssh-form-row--split">
                <div>
                    <label><?php esc_html_e( 'Pitch Length (m)', 'gilba-hub' ); ?></label>
                    <input type="number" id="gssh-custom-length" min="90" max="120"
                           value="<?php echo esc_attr( $defaults['length'] ); ?>">
                </div>
                <div>
                    <label><?php esc_html_e( 'Pitch Width (m)', 'gilba-hub' ); ?></label>
                    <input type="number" id="gssh-custom-width" min="60" max="90"
                           value="<?php echo esc_attr( $defaults['width'] ); ?>">
                </div>
            </div>

            <div class="gssh-form-row">
                <label><?php esc_html_e( 'Pitch Orientation (° from North)', 'gilba-hub' ); ?></label>
                <input type="number" id="gssh-custom-orientation" min="0" max="359" step="1"
                       value="<?php echo esc_attr( $defaults['orientation'] ); ?>">
                <span class="description"><?php esc_html_e( '0 = long axis N-S; 90 = E-W', 'gilba-hub' ); ?></span>
            </div>

            <div class="gssh-form-row">
                <label><?php esc_html_e( 'Stands Configuration', 'gilba-hub' ); ?></label>
                <div id="gssh-stands-editor" class="gssh-stands-editor">
                    <?php echo self::render_stands_editor( $defaults['stands'] ); ?>
                </div>
            </div>

            <input type="hidden" id="gssh-custom-nonce" value="<?php echo esc_attr( $nonce ); ?>">

            <div class="gssh-form-actions">
                <button type="button" id="gssh-save-custom-venue" class="button button-primary">
                    <?php esc_html_e( 'Save Custom Venue', 'gilba-hub' ); ?>
                </button>
                <span id="gssh-custom-venue-status" class="gssh-status-message"></span>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render the stands editor sub-form.
     */
    public static function render_stands_editor( array $stands = array() ): string {
        $sides = array( 'north', 'south', 'east', 'west' );
        ob_start();
        foreach ( $sides as $side ) {
            $h = isset( $stands[ $side ]['height_m'] ) ? floatval( $stands[ $side ]['height_m'] ) : 0;
            $r = isset( $stands[ $side ]['roof']     ) ? (bool) $stands[ $side ]['roof']          : false;
            ?>
            <div class="gssh-stand-row">
                <span class="gssh-stand-label"><?php echo esc_html( ucfirst( $side ) ); ?></span>
                <label><?php esc_html_e( 'Height (m)', 'gilba-hub' ); ?>
                    <input type="number" name="stands[<?php echo esc_attr( $side ); ?>][height_m]"
                           min="0" max="80" step="0.5" value="<?php echo esc_attr( $h ); ?>">
                </label>
                <label>
                    <input type="checkbox" name="stands[<?php echo esc_attr( $side ); ?>][roof]"
                           value="1" <?php checked( $r ); ?>>
                    <?php esc_html_e( 'Roof', 'gilba-hub' ); ?>
                </label>
            </div>
            <?php
        }
        return ob_get_clean();
    }
}
