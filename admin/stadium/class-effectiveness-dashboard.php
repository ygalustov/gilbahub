<?php
/**
 * Effectiveness Dashboard UI
 *
 * Renders the supplemental lighting effectiveness tracking dashboard.
 * Displays recorded outcomes (visual turf quality, growth response, DLI achieved)
 * against targets for each rig session logged via Gssh_Effectiveness_Tracker.
 *
 * @package Gilba_Agronomic_Intelligence_Hub
 * @subpackage Stadium
 * @version 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Effectiveness_Dashboard {

    /**
     * Render the full effectiveness dashboard panel.
     *
     * @param string $venue_id Venue identifier.
     * @param array  $records  Outcome records from Gssh_Effectiveness_Tracker::get_records().
     * @param array  $args     Display options.
     * @return string HTML
     */
    public static function render( string $venue_id, array $records = array(), array $args = array() ): string {
        $args = wp_parse_args( $args, array(
            'show_chart'  => true,
            'show_table'  => true,
            'max_records' => 30,
        ) );

        $records = array_slice( $records, 0, $args['max_records'] );

        ob_start();
        ?>
        <div class="gssh-effectiveness-dashboard" data-venue="<?php echo esc_attr( $venue_id ); ?>">

            <div class="gssh-dashboard-header">
                <h4><?php esc_html_e( 'Supplemental Lighting Effectiveness', 'gilba-hub' ); ?></h4>
                <?php if ( ! empty( $records ) ) : ?>
                    <span class="gssh-record-count">
                        <?php echo esc_html( count( $records ) ); ?> <?php esc_html_e( 'sessions recorded', 'gilba-hub' ); ?>
                    </span>
                <?php endif; ?>
            </div>

            <?php if ( empty( $records ) ) : ?>
                <div class="gssh-no-records notice notice-info inline">
                    <p><?php esc_html_e( 'No effectiveness records yet. Records are created automatically when rig sessions are completed.', 'gilba-hub' ); ?></p>
                </div>
            <?php else : ?>

                <?php if ( $args['show_chart'] ) : ?>
                    <?php echo self::render_summary_cards( $records ); ?>
                    <?php echo self::render_trend_chart( $records ); ?>
                <?php endif; ?>

                <?php if ( $args['show_table'] ) : ?>
                    <?php echo self::render_records_table( $records ); ?>
                <?php endif; ?>

            <?php endif; ?>

            <div class="gssh-log-session">
                <button type="button" class="button gssh-log-session-btn">
                    <?php esc_html_e( 'Log Session Outcome', 'gilba-hub' ); ?>
                </button>
            </div>

        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render KPI summary cards (mean DLI achieved, mean quality score, sessions this month).
     */
    public static function render_summary_cards( array $records ): string {
        $dli_values     = array_filter( array_column( $records, 'dli_achieved' ) );
        $quality_values = array_filter( array_column( $records, 'quality_score' ) );

        $mean_dli     = count( $dli_values )     ? round( array_sum( $dli_values )     / count( $dli_values ), 1 )     : null;
        $mean_quality = count( $quality_values ) ? round( array_sum( $quality_values ) / count( $quality_values ), 1 ) : null;

        $this_month = 0;
        $ym = date( 'Y-m' );
        foreach ( $records as $r ) {
            if ( isset( $r['date'] ) && strncmp( $r['date'], $ym, 7 ) === 0 ) {
                $this_month++;
            }
        }

        ob_start();
        ?>
        <div class="gssh-kpi-cards">
            <div class="gssh-kpi-card">
                <span class="gssh-kpi-label"><?php esc_html_e( 'Mean DLI Achieved', 'gilba-hub' ); ?></span>
                <span class="gssh-kpi-value">
                    <?php echo $mean_dli !== null ? esc_html( $mean_dli ) . ' mol/m²/d' : esc_html__( 'N/A', 'gilba-hub' ); ?>
                </span>
            </div>
            <div class="gssh-kpi-card">
                <span class="gssh-kpi-label"><?php esc_html_e( 'Mean Quality Score', 'gilba-hub' ); ?></span>
                <span class="gssh-kpi-value">
                    <?php echo $mean_quality !== null ? esc_html( $mean_quality ) . ' / 10' : esc_html__( 'N/A', 'gilba-hub' ); ?>
                </span>
            </div>
            <div class="gssh-kpi-card">
                <span class="gssh-kpi-label"><?php esc_html_e( 'Sessions This Month', 'gilba-hub' ); ?></span>
                <span class="gssh-kpi-value"><?php echo esc_html( $this_month ); ?></span>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render trend chart placeholder (data-driven, wired to JS chart renderer).
     */
    public static function render_trend_chart( array $records ): string {
        $chart_data = array_map( function( $r ) {
            return array(
                'date'    => $r['date']         ?? '',
                'dli'     => $r['dli_achieved'] ?? null,
                'quality' => $r['quality_score'] ?? null,
            );
        }, $records );

        return sprintf(
            '<div class="gssh-effectiveness-chart" data-chart="%s"></div>',
            esc_attr( wp_json_encode( $chart_data ) )
        );
    }

    /**
     * Render the records table.
     */
    public static function render_records_table( array $records ): string {
        ob_start();
        ?>
        <table class="gssh-effectiveness-table widefat striped">
            <thead>
                <tr>
                    <th><?php esc_html_e( 'Date', 'gilba-hub' ); ?></th>
                    <th><?php esc_html_e( 'Rig', 'gilba-hub' ); ?></th>
                    <th><?php esc_html_e( 'Hours', 'gilba-hub' ); ?></th>
                    <th><?php esc_html_e( 'DLI Achieved', 'gilba-hub' ); ?></th>
                    <th><?php esc_html_e( 'Quality', 'gilba-hub' ); ?></th>
                    <th><?php esc_html_e( 'Notes', 'gilba-hub' ); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ( $records as $r ) : ?>
                    <tr>
                        <td><?php echo esc_html( $r['date']          ?? '' ); ?></td>
                        <td><?php echo esc_html( $r['rig_model']     ?? '' ); ?></td>
                        <td><?php echo esc_html( $r['hours_run']     ?? '' ); ?></td>
                        <td>
                            <?php if ( isset( $r['dli_achieved'] ) ) : ?>
                                <?php echo esc_html( round( $r['dli_achieved'], 1 ) ); ?> mol/m²/d
                            <?php else : ?>
                                &mdash;
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if ( isset( $r['quality_score'] ) ) : ?>
                                <?php echo esc_html( $r['quality_score'] ); ?> / 10
                            <?php else : ?>
                                &mdash;
                            <?php endif; ?>
                        </td>
                        <td><?php echo esc_html( $r['notes'] ?? '' ); ?></td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php
        return ob_get_clean();
    }
}
