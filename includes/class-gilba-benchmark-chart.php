<?php
/**
 * =============================================================================
 * GILBA BENCHMARK CHART — Shortcode [gaip_benchmark] v1.2.0
 * =============================================================================
 *
 * v1.2.0: JS moved to enqueued asset file (benchmark-chart.js) — no inline
 * script blocks. Eliminates suppression by browser extensions (wfd-invisible).
 * Config passed via window.GAIP_BenchmarkConfig[uid] JSON object.
 *
 * USAGE:
 *   [gaip_benchmark]
 *   [gaip_benchmark module="disease" days="90" limit="200"]
 *   [gaip_benchmark site_id="-35.331_149.11_hd3u1k"]
 *
 * FILE PLACEMENT:
 *   includes/class-gilba-benchmark-chart.php
 *   assets/benchmark-chart.js
 *
 * @version 1.2.0
 * @author  Gilba Solutions
 * =============================================================================
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Gilba_Benchmark_Chart {

    const VERSION        = '1.2.0';
    const REST_NAMESPACE = 'gilba/v1';

    private static $instance = null;

    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_shortcode( 'gaip_benchmark',  array( $this, 'render_shortcode' ) );
        add_action( 'rest_api_init',      array( $this, 'register_rest_routes' ) );
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
    }

    // =========================================================================
    // ASSET ENQUEUE
    // =========================================================================

    public function enqueue_assets() {
        if ( is_admin() ) return;

        $plugin_url = plugin_dir_url( dirname( __FILE__ ) );
        $ver        = filemtime( plugin_dir_path( dirname( __FILE__ ) ) . 'assets/benchmark-chart.js' ) ?: self::VERSION;

        // Chart.js + adapter + annotation (footer)
        wp_enqueue_script(
            'chartjs',
            'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
            array(),
            '4.4.1',
            true
        );
        wp_enqueue_script(
            'chartjs-adapter-date-fns',
            'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3/dist/chartjs-adapter-date-fns.bundle.min.js',
            array( 'chartjs' ),
            '3.0.0',
            true
        );
        wp_enqueue_script(
            'chartjs-plugin-annotation',
            'https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3/dist/chartjs-plugin-annotation.min.js',
            array( 'chartjs' ),
            '3.0.0',
            true
        );

        // Benchmark logic — depends on Chart.js + adapter, loads in footer
        wp_enqueue_script(
            'gaip-benchmark-chart',
            $plugin_url . 'assets/benchmark-chart.js',
            array( 'chartjs-adapter-date-fns', 'chartjs-plugin-annotation' ),
            $ver,
            true  // footer
        );
    }

    // =========================================================================
    // REST ROUTE — GET /gilba/v1/benchmark/{site_id}
    // =========================================================================

    public function register_rest_routes() {
        register_rest_route( self::REST_NAMESPACE, '/benchmark/(?P<site_id>.+)', array(
            'methods'             => 'GET',
            'callback'            => array( $this, 'handle_get_benchmark' ),
            'permission_callback' => function() { return is_user_logged_in(); },
            'args'                => array(
                'module' => array( 'default' => 'disease',  'sanitize_callback' => 'sanitize_text_field' ),
                'limit'  => array( 'default' => 200,        'sanitize_callback' => 'absint' ),
                'days'   => array( 'default' => 90,         'sanitize_callback' => 'absint' ),
            ),
        ) );
    }

    public function handle_get_benchmark( $request ) {
        global $wpdb;

        $site_id = sanitize_text_field( $request->get_param( 'site_id' ) );
        $module  = sanitize_text_field( $request->get_param( 'module' ) ?: 'disease' );
        $limit   = min( absint( $request->get_param( 'limit' ) ?: 200 ), 500 );
        $days    = min( absint( $request->get_param( 'days' )  ?: 90 ),  730 );

        $pred_table    = $wpdb->prefix . 'gilba_predictions';
        $outcome_table = $wpdb->prefix . 'gilba_outcomes';
        $cutoff        = date( 'Y-m-d H:i:s', strtotime( "-{$days} days" ) );

        $outcomes = $wpdb->get_results( $wpdb->prepare(
            "SELECT p.sub_key, p.predicted_at, p.predicted_value, p.predicted_category,
                    p.confidence, o.captured_at, o.qualitative, o.observed_value, o.observed_category
             FROM {$outcome_table} o
             INNER JOIN {$pred_table} p ON o.prediction_id = p.id
             WHERE p.site_id = %s AND p.module = %s AND p.predicted_at >= %s
             ORDER BY p.predicted_at ASC LIMIT %d",
            $site_id, $module, $cutoff, $limit
        ), ARRAY_A );

        $pending = $wpdb->get_results( $wpdb->prepare(
            "SELECT sub_key, predicted_at, predicted_value, predicted_category,
                    confidence, outcome_window_start, outcome_window_end, status
             FROM {$pred_table}
             WHERE site_id = %s AND module = %s AND predicted_at >= %s
               AND status IN ('pending','expired')
             ORDER BY predicted_at ASC LIMIT %d",
            $site_id, $module, $cutoff, $limit
        ), ARRAY_A );

        // Accuracy summary
        $accuracy = array();
        if ( ! empty( $outcomes ) ) {
            $by_key = array();
            foreach ( $outcomes as $row ) {
                $k = $row['sub_key'];
                if ( ! isset( $by_key[$k] ) ) $by_key[$k] = array( 'total' => 0, 'as_expected' => 0, 'better' => 0, 'worse' => 0 );
                $by_key[$k]['total']++;
                $q = $row['qualitative'] ?? '';
                if ( $q === 'as_expected' )             $by_key[$k]['as_expected']++;
                elseif ( $q === 'better_than_expected' ) $by_key[$k]['better']++;
                elseif ( $q === 'worse_than_expected' )  $by_key[$k]['worse']++;
            }
            foreach ( $by_key as $k => $c ) {
                $accuracy[$k] = array(
                    'total'        => $c['total'],
                    'as_expected'  => $c['as_expected'],
                    'better'       => $c['better'],
                    'worse'        => $c['worse'],
                    'accuracy_pct' => $c['total'] > 0
                        ? round( ( $c['as_expected'] + $c['better'] ) / $c['total'] * 100 )
                        : null,
                );
            }
        }

        return new WP_REST_Response( array(
            'success'  => true,
            'site_id'  => $site_id,
            'module'   => $module,
            'days'     => $days,
            'outcomes' => $outcomes  ?: array(),
            'pending'  => $pending   ?: array(),
            'accuracy' => $accuracy,
            'counts'   => array(
                'outcomes' => count( $outcomes ),
                'pending'  => count( $pending ),
            ),
        ), 200 );
    }

    // =========================================================================
    // SHORTCODE RENDER — outputs div + config object + styles only (no inline JS)
    // =========================================================================

    public function render_shortcode( $atts ) {
        $atts = shortcode_atts( array(
            'site_id'  => '',
            'rest_url' => '',
            'module'   => 'disease',
            'limit'    => '200',
            'days'     => '90',
            'title'    => '',
        ), $atts, 'gaip_benchmark' );

        $uid      = 'gaip-bmc-' . wp_unique_id();
        $rest_url = $atts['rest_url'] ?: rest_url( 'gilba/v1/' );
        $nonce    = wp_create_nonce( 'wp_rest' );
        $module   = sanitize_key( $atts['module'] );
        $limit    = intval( $atts['limit'] );
        $days     = intval( $atts['days'] );
        $site_id  = sanitize_text_field( $atts['site_id'] );
        $title    = sanitize_text_field( $atts['title'] ?: ucfirst( $atts['module'] ) . ' Risk — Historical Benchmark' );

        // Config object passed to JS — output as direct inline script in shortcode HTML.
        // wp_add_inline_script is unreliable when shortcode runs after wp_enqueue_scripts.
        $config_json = json_encode( array(
            'rootId'         => $uid,
            'restUrl'        => $rest_url,
            'nonce'          => $nonce,
            'module'         => $module,
            'limit'          => $limit,
            'days'           => $days,
            'title'          => $title,
            'siteIdOverride' => $site_id,
        ) );

        ob_start();
        ?>
        <script>window.GAIP_BenchmarkConfig=window.GAIP_BenchmarkConfig||{};window.GAIP_BenchmarkConfig[<?php echo json_encode($uid); ?>]=<?php echo $config_json; ?>;</script>
        <div id="<?php echo esc_attr( $uid ); ?>" class="gaip-benchmark-root" data-module="<?php echo esc_attr( $module ); ?>"></div>

        <style>
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

        .gaip-benchmark-root { display: block; box-sizing: border-box; }
        .gaip-benchmark-root *, .gaip-benchmark-root *::before, .gaip-benchmark-root *::after { box-sizing: border-box; }

        .bmc-wrap {
            background: #0a0f1a; color: #e2e8f0;
            font-family: 'IBM Plex Sans', sans-serif;
            border: 1px solid #1e293b; border-radius: 4px;
            padding: 24px 28px 20px; position: relative; overflow: hidden;
        }
        .bmc-wrap::before {
            content: ''; position: absolute; inset: 0;
            background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
            background-size: 40px 40px; pointer-events: none;
        }
        .bmc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; position: relative; }
        .bmc-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 500; letter-spacing: 0.18em; color: #475569; text-transform: uppercase; margin-bottom: 4px; }
        .bmc-title { font-size: 1.05rem; font-weight: 500; color: #f1f5f9; margin: 0; letter-spacing: -0.01em; line-height: 1.3; }
        .bmc-meta-block { text-align: right; flex-shrink: 0; margin-left: 24px; }
        .bmc-meta-item { font-family: 'IBM Plex Mono', monospace; font-size: 1.4rem; font-weight: 500; color: #f97316; line-height: 1; }
        .bmc-meta-label { font-size: 0.68rem; color: #475569; margin-top: 1px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
        .bmc-mock-banner { font-size: 0.75rem; color: #92400e; background: #451a0310; border: 1px solid #78350f40; border-radius: 3px; padding: 6px 10px; margin-bottom: 16px; font-family: 'IBM Plex Mono', monospace; position: relative; }
        .bmc-accuracy-strip { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; position: relative; }
        .bmc-acc-card { background: #0f172a; border: 1px solid #1e293b; border-radius: 3px; padding: 8px 12px; min-width: 120px; }
        .bmc-acc-name { font-size: 0.68rem; color: #64748b; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
        .bmc-acc-score { font-family: 'IBM Plex Mono', monospace; font-size: 1.3rem; font-weight: 500; line-height: 1; }
        .bmc-acc-label { font-size: 0.62rem; color: #475569; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .bmc-acc-breakdown { font-size: 0.68rem; font-family: 'IBM Plex Mono', monospace; display: flex; gap: 8px; }
        .bmc-acc-better { color: #22c55e; } .bmc-acc-match { color: #94a3b8; } .bmc-acc-worse { color: #ef4444; }
        .bmc-chart-wrap { position: relative; height: 320px; margin-bottom: 14px; }
        .bmc-legend { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-bottom: 14px; position: relative; }
        .bmc-legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: #94a3b8; }
        .bmc-legend-swatch { width: 20px; height: 3px; border-radius: 2px; flex-shrink: 0; }
        .bmc-legend-label { color: #cbd5e1; }
        .bmc-legend-count { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; color: #475569; background: #1e293b; padding: 1px 5px; border-radius: 2px; }
        .bmc-legend-key { font-size: 0.7rem; color: #475569; font-family: 'IBM Plex Mono', monospace; margin-left: auto; }
        .bmc-dot-match { color: #94a3b8; } .bmc-dot-better { color: #22c55e; } .bmc-dot-worse { color: #ef4444; } .bmc-dot-pending { color: #475569; }
        .bmc-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #1e293b; padding-top: 10px; position: relative; }
        .bmc-footer-note { font-size: 0.65rem; color: #334155; font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.02em; }
        @media (max-width: 600px) {
            .bmc-wrap { padding: 16px; }
            .bmc-chart-wrap { height: 240px; }
            .bmc-meta-block { display: none; }
            .bmc-legend-key { margin-left: 0; width: 100%; margin-top: 8px; }
        }
        </style>
        <?php
        return ob_get_clean();
    }
}

Gilba_Benchmark_Chart::get_instance();
