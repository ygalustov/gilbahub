<?php
/**
 * Zone Configuration UI
 *
 * Admin and front-end UI for defining supplemental lighting zones within a venue.
 * Zones map pitch areas to rig positions, DLI targets, and operating schedules.
 *
 * @package Gilba_Agronomic_Intelligence_Hub
 * @subpackage Stadium
 * @version 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Zone_Configuration_UI {

    /** Default zone template */
    const ZONE_DEFAULTS = array(
        'id'          => '',
        'label'       => '',
        'area_m2'     => 0,
        'dli_target'  => 12,
        'priority'    => 'high',
        'rig_count'   => 0,
        'notes'       => '',
    );

    /**
     * Render the full zone configuration panel.
     *
     * @param string $venue_id  Venue identifier.
     * @param array  $zones     Existing zone definitions.
     * @return string HTML
     */
    public static function render( string $venue_id, array $zones = array() ): string {
        ob_start();
        ?>
        <div class="gssh-zone-config" data-venue="<?php echo esc_attr( $venue_id ); ?>">
            <div class="gssh-zone-config__header">
                <h4><?php esc_html_e( 'Lighting Zone Configuration', 'gilba-hub' ); ?></h4>
                <button type="button" class="button gssh-add-zone">
                    <?php esc_html_e( '+ Add Zone', 'gilba-hub' ); ?>
                </button>
            </div>

            <div id="gssh-zones-list">
                <?php if ( empty( $zones ) ) : ?>
                    <p class="gssh-no-zones description">
                        <?php esc_html_e( 'No zones defined. Add a zone to specify DLI targets for pitch areas.', 'gilba-hub' ); ?>
                    </p>
                <?php else : ?>
                    <?php foreach ( $zones as $zone ) : ?>
                        <?php echo self::render_zone_row( $zone ); ?>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>

            <div id="gssh-zone-summary" class="gssh-zone-summary" style="display:none;">
                <strong><?php esc_html_e( 'Zone Summary', 'gilba-hub' ); ?></strong>
                <span id="gssh-zone-count">0</span> <?php esc_html_e( 'zones', 'gilba-hub' ); ?> |
                <?php esc_html_e( 'Total area:', 'gilba-hub' ); ?> <span id="gssh-zone-total-area">0</span> m²
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render a single zone editor row.
     *
     * @param array $zone Zone data.
     * @return string HTML
     */
    public static function render_zone_row( array $zone ): string {
        $zone = wp_parse_args( $zone, self::ZONE_DEFAULTS );

        ob_start();
        ?>
        <div class="gssh-zone-row" data-zone-id="<?php echo esc_attr( $zone['id'] ); ?>">
            <div class="gssh-zone-row__fields">
                <input type="text" class="gssh-zone-label" placeholder="<?php esc_attr_e( 'Zone label', 'gilba-hub' ); ?>"
                       value="<?php echo esc_attr( $zone['label'] ); ?>">

                <label><?php esc_html_e( 'Area (m²)', 'gilba-hub' ); ?>
                    <input type="number" class="gssh-zone-area" min="0" step="10"
                           value="<?php echo esc_attr( $zone['area_m2'] ); ?>">
                </label>

                <label><?php esc_html_e( 'DLI Target', 'gilba-hub' ); ?>
                    <input type="number" class="gssh-zone-dli" min="1" max="60" step="0.5"
                           value="<?php echo esc_attr( $zone['dli_target'] ); ?>">
                    <span class="description">mol/m²/d</span>
                </label>

                <label><?php esc_html_e( 'Priority', 'gilba-hub' ); ?>
                    <select class="gssh-zone-priority">
                        <?php foreach ( array( 'critical', 'high', 'medium', 'low' ) as $p ) : ?>
                            <option value="<?php echo esc_attr( $p ); ?>" <?php selected( $zone['priority'], $p ); ?>>
                                <?php echo esc_html( ucfirst( $p ) ); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </label>
            </div>
            <button type="button" class="button-link gssh-remove-zone" title="<?php esc_attr_e( 'Remove zone', 'gilba-hub' ); ?>">
                &times;
            </button>
        </div>
        <?php
        return ob_get_clean();
    }
}
