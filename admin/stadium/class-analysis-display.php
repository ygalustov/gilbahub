<?php
/**
 * Stadium Analysis Display UI
 *
 * Renders shade analysis results, daily shade patterns, and DLI gap summaries
 * in the admin and front-end stadium hub tabs.
 *
 * @package Gilba_Agronomic_Intelligence_Hub
 * @subpackage Stadium
 * @version 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Analysis_Display {

    /**
     * Render the full analysis results panel.
     *
     * @param array $analysis_result Result array from Gssh_Shade_Engine::analyse()
     * @param array $args            Optional display args (venue_name, date, etc.)
     * @return string HTML
     */
    public static function render( array $analysis_result, $args = array() ): string {
        $args = wp_parse_args( $args, array(
            'venue_name' => '',
            'date'       => '',
            'show_dli'   => true,
            'show_chart' => true,
        ) );

        ob_start();
        ?>
        <div class="gssh-analysis-display">
            <?php if ( $args['venue_name'] ) : ?>
                <h3 class="gssh-analysis-venue"><?php echo esc_html( $args['venue_name'] ); ?></h3>
            <?php endif; ?>

            <?php if ( ! empty( $analysis_result['error'] ) ) : ?>
                <div class="gssh-analysis-error notice notice-error">
                    <p><?php echo esc_html( $analysis_result['error'] ); ?></p>
                </div>
                <?php return ob_get_clean(); ?>
            <?php endif; ?>

            <?php if ( $args['show_dli'] && isset( $analysis_result['dli_summary'] ) ) : ?>
                <?php echo self::render_dli_summary( $analysis_result['dli_summary'], $args ); ?>
            <?php endif; ?>

            <?php if ( $args['show_chart'] && isset( $analysis_result['hourly'] ) ) : ?>
                <?php echo self::render_hourly_chart( $analysis_result['hourly'] ); ?>
            <?php endif; ?>

            <?php if ( isset( $analysis_result['shade_zones'] ) ) : ?>
                <?php echo self::render_shade_zones( $analysis_result['shade_zones'] ); ?>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render DLI summary card.
     */
    public static function render_dli_summary( array $dli, array $args = array() ): string {
        ob_start();
        $ambient  = round( $dli['ambient_dli'] ?? 0, 1 );
        $received = round( $dli['received_dli'] ?? 0, 1 );
        $deficit  = round( max( 0, $ambient - $received ), 1 );
        $pct      = $ambient > 0 ? round( ( $received / $ambient ) * 100 ) : 0;
        ?>
        <div class="gssh-dli-summary-card">
            <div class="gssh-dli-row">
                <span class="gssh-dli-label"><?php esc_html_e( 'Ambient DLI', 'gilba-hub' ); ?></span>
                <span class="gssh-dli-value"><?php echo esc_html( $ambient ); ?> mol/m²/d</span>
            </div>
            <div class="gssh-dli-row">
                <span class="gssh-dli-label"><?php esc_html_e( 'Received DLI', 'gilba-hub' ); ?></span>
                <span class="gssh-dli-value"><?php echo esc_html( $received ); ?> mol/m²/d</span>
            </div>
            <div class="gssh-dli-row">
                <span class="gssh-dli-label"><?php esc_html_e( 'Shade reduction', 'gilba-hub' ); ?></span>
                <span class="gssh-dli-value gssh-dli-deficit"><?php echo esc_html( $deficit ); ?> mol/m²/d (<?php echo esc_html( 100 - $pct ); ?>%)</span>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render hourly PAR/shade chart (placeholder — wired to JS chart renderer).
     */
    public static function render_hourly_chart( array $hourly ): string {
        $json = wp_json_encode( $hourly );
        return sprintf(
            '<div class="gssh-hourly-chart" data-hourly="%s"></div>',
            esc_attr( $json )
        );
    }

    /**
     * Render shade zone breakdown table.
     */
    public static function render_shade_zones( array $zones ): string {
        if ( empty( $zones ) ) {
            return '';
        }
        ob_start();
        ?>
        <table class="gssh-shade-zones-table widefat striped">
            <thead>
                <tr>
                    <th><?php esc_html_e( 'Zone', 'gilba-hub' ); ?></th>
                    <th><?php esc_html_e( 'Shade Hours', 'gilba-hub' ); ?></th>
                    <th><?php esc_html_e( 'DLI Received', 'gilba-hub' ); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ( $zones as $zone ) : ?>
                    <tr>
                        <td><?php echo esc_html( $zone['label'] ?? '' ); ?></td>
                        <td><?php echo esc_html( round( $zone['shade_hours'] ?? 0, 1 ) ); ?>h</td>
                        <td><?php echo esc_html( round( $zone['dli'] ?? 0, 1 ) ); ?> mol/m²/d</td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php
        return ob_get_clean();
    }
}
