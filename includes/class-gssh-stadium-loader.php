<?php
/**
 * GSSH Stadium Module Loader
 * 
 * Loads Stadium Light PHP classes into the merged Stadium Shade Hub.
 * Registers AJAX endpoints for shade analysis, rig calculation, and seasonal planning.
 * 
 * @package Gilba_Stadium_Shade_Hub
 * @version 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class GSSH_Stadium_Loader {

    private static $instance = null;
    private $stadium_dir;
    private $admin_dir;
    private $data_dir;

    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $plugin_dir = plugin_dir_path( dirname( __FILE__ ) );
        $this->stadium_dir = $plugin_dir . 'includes/stadium/';
        $this->admin_dir   = $plugin_dir . 'admin/stadium/';
        $this->data_dir    = $plugin_dir . 'data/stadiums/';

        $this->load_classes();
        $this->register_ajax_handlers();

        // Register stadium shortcodes (standalone usage outside [gssh_hub])
        Gssh_Stadium_Shortcodes::register();
    }

    /**
     * Compatibility: get venue config by ID
     * Used by test shortcodes
     */
    public function get_venue_config( $venue_id ) {
        return Gssh_Stadium_Database::get_stadium( $venue_id );
    }

    /**
     * Compatibility: get supplemental light module
     * Used by test shortcodes
     */
    public function get_module() {
        return new Gssh_Supplemental_Light_Module();
    }

    /**
     * Load stadium PHP classes
     */
    private function load_classes() {
        // Core calculation classes
        require_once $this->stadium_dir . 'interface-shade-engine.php';
        require_once $this->stadium_dir . 'class-geometry-utils.php';
        require_once $this->stadium_dir . 'class-shade-engine.php';
        require_once $this->stadium_dir . 'class-radial-obstruction-profile.php';
        require_once $this->stadium_dir . 'class-shade-visualiser.php';
        require_once $this->stadium_dir . 'class-rig-placement-calculator.php';
        require_once $this->stadium_dir . 'class-rig-placement-visualiser.php';
        require_once $this->stadium_dir . 'class-schedule-optimiser.php';
        require_once $this->stadium_dir . 'class-dli-gap-calculator.php';
        require_once $this->stadium_dir . 'class-eue-calculator.php';
        require_once $this->stadium_dir . 'class-supplemental-light-module.php';

        // Data and adapters
        require_once $this->stadium_dir . 'class-stadium-database.php';
        require_once $this->stadium_dir . 'class-ambient-dli-estimator.php';
        require_once $this->stadium_dir . 'class-hub-climate-adapter.php';
        require_once $this->stadium_dir . 'class-hub-variety-adapter.php';
        require_once $this->stadium_dir . 'class-data-store.php';

        // Support classes
        require_once $this->stadium_dir . 'class-currency-formatter.php';
        require_once $this->stadium_dir . 'class-effectiveness-tracker.php';
        require_once $this->stadium_dir . 'class-roof-par-filter.php';

        // Stadium shortcodes (standalone usage + tab renderers)
        require_once $this->stadium_dir . 'class-shortcodes.php';

        // Initialize radial obstruction profiles with JSON data files
        $profile_files = array(
            $this->data_dir . 'stadium_obstruction_profiles_sample.json',
            $this->data_dir . 'uk_stadium_obstruction_profiles.json',
            $this->data_dir . 'japan_j1_stadium_obstruction_profiles.json',
            $this->data_dir . 'australia_stadium_obstruction_profiles.json',
        );
        Gssh_Radial_Obstruction_Profile::init( array_filter( $profile_files, 'file_exists' ) );

        // Generate radial profiles for venues without LiDAR data
        // These are derived from the structure geometry in the database.
        // LiDAR profiles take precedence when available.
        require_once $this->stadium_dir . 'class-radial-profile-generator.php';
        Gssh_Radial_Profile_Generator::register_generated_profiles();

        // Admin UI (only on admin or when shortcode renders)
        if ( is_admin() || $this->is_stadium_page() ) {
            require_once $this->admin_dir . 'class-analysis-display.php';
            require_once $this->admin_dir . 'class-custom-venue-ui.php';
            require_once $this->admin_dir . 'class-zone-configuration-ui.php';
            require_once $this->admin_dir . 'class-effectiveness-dashboard.php';
        }
    }

    /**
     * Register AJAX handlers for stadium functionality
     * These replace the standalone Stadium Light plugin's AJAX endpoints
     */
    private function register_ajax_handlers() {
        // Shade analysis
        add_action( 'wp_ajax_gssh_shade_analysis',        array( $this, 'ajax_shade_analysis' ) );
        add_action( 'wp_ajax_nopriv_gssh_shade_analysis', array( $this, 'ajax_shade_analysis' ) );

        // Shade render (for dynamic UI updates)
        add_action( 'wp_ajax_gssh_shade_render',        array( $this, 'ajax_shade_render' ) );
        add_action( 'wp_ajax_nopriv_gssh_shade_render', array( $this, 'ajax_shade_render' ) );

        // Rig placement calculation
        add_action( 'wp_ajax_gssh_rig_calculate',        array( $this, 'ajax_rig_render' ) );
        add_action( 'wp_ajax_nopriv_gssh_rig_calculate', array( $this, 'ajax_rig_render' ) );

        // Seasonal planner
        add_action( 'wp_ajax_gssh_seasonal_plan',        array( $this, 'ajax_planner_render' ) );
        add_action( 'wp_ajax_nopriv_gssh_seasonal_plan', array( $this, 'ajax_planner_render' ) );

        // Stadium database lookups
        add_action( 'wp_ajax_gssh_get_stadium',        array( $this, 'ajax_get_stadium' ) );
        add_action( 'wp_ajax_nopriv_gssh_get_stadium', array( $this, 'ajax_get_stadium' ) );

        // Custom venue save
        add_action( 'wp_ajax_gssh_save_custom_venue', array( $this, 'ajax_save_custom_venue' ) );

        // Custom venue delete
        add_action( 'wp_ajax_gssh_delete_custom_venue', array( $this, 'ajax_delete_custom_venue' ) );

        // Venue turf profile save/get
        add_action( 'wp_ajax_gssh_save_venue_profile',  array( $this, 'ajax_save_venue_profile' ) );
        add_action( 'wp_ajax_gssh_get_venue_profiles',  array( $this, 'ajax_get_venue_profiles' ) );

        // Effectiveness tracking
        add_action( 'wp_ajax_gssh_track_effectiveness', array( $this, 'ajax_track_effectiveness' ) );

        // Nonce refresh — sensor-integration-manager.js calls gilba_refresh_nonce on both
        // GAIP and GSSH pages. Register it here so the action isn't unknown (400) on GSSH pages.
        // Returns a fresh gssh_hub_nonce so subsequent AJAX calls validate correctly.
        add_action( 'wp_ajax_gilba_refresh_nonce', array( $this, 'ajax_refresh_nonce' ) );
    }

    /**
     * Check if current page uses the GSSH hub shortcode
     */
    private function is_stadium_page() {
        global $post;
        return is_a( $post, 'WP_Post' ) && has_shortcode( $post->post_content, 'gssh_hub' );
    }

    // =========================================================================
    // AJAX HANDLERS
    // =========================================================================

    /**
     * Nonce refresh endpoint — called by sensor-integration-manager.js on wake-from-sleep.
     * Returns a fresh gssh_hub_nonce so subsequent GSSH AJAX calls validate correctly.
     */
    public function ajax_refresh_nonce() {
        if ( ! is_user_logged_in() ) {
            wp_send_json_error( array( 'message' => 'Not logged in' ), 401 );
            wp_die();
        }
        wp_send_json_success( array(
            'nonce' => wp_create_nonce( 'gssh_hub_nonce' )
        ) );
        wp_die();
    }

    /**
     * Extract hub_dli, hub_ghi, hub_temperature from POST and store in
     * $GLOBALS so Gssh_Hub_Climate_Adapter::get_solar_radiation() can
     * use real Open-Meteo data instead of the astronomical estimator.
     */
    private function forward_hub_climate_data() {
        if ( isset( $_POST['hub_dli'] ) && is_numeric( $_POST['hub_dli'] ) ) {
            $GLOBALS['gssh_hub_dli'] = floatval( $_POST['hub_dli'] );
        }
        if ( isset( $_POST['hub_ghi'] ) && is_numeric( $_POST['hub_ghi'] ) ) {
            $GLOBALS['gssh_hub_ghi'] = floatval( $_POST['hub_ghi'] );
        }
        if ( isset( $_POST['hub_temperature'] ) && is_numeric( $_POST['hub_temperature'] ) ) {
            $GLOBALS['gssh_hub_temperature'] = floatval( $_POST['hub_temperature'] );
        }
    }

    public function ajax_shade_analysis() {
        check_ajax_referer( 'gssh_hub_nonce', 'nonce' );
        $this->forward_hub_climate_data(); // Bug 3 fix: use Open-Meteo data when available

        $venue_id  = sanitize_text_field( $_POST['venue_id'] ?? '' );
        $date      = sanitize_text_field( $_POST['date'] ?? date( 'Y-m-d' ) );
        $lat       = floatval( $_POST['lat'] ?? 0 );
        $lng       = floatval( $_POST['lng'] ?? 0 );

        // b35fix249: Roof state for retractable-roof venues (e.g. Marvel Stadium).
        // 'closed' applies the venue's roof permeability as a DLI multiplier.
        // Defaults to 'open' — no attenuation for venues without a retractable roof.
        $allowed_roof_states = [ 'open', 'closed', 'unknown' ];
        $roof_state = sanitize_text_field( $_POST['roof_state'] ?? 'open' );
        if ( ! in_array( $roof_state, $allowed_roof_states, true ) ) {
            $roof_state = 'open';
        }

        // b35fix176 G7e: Gssh_Stadium_Database is a static class — it has no
        // has_venue() or get_obstruction_profile() instance methods. The previous
        // code was instantiating it and calling non-existent methods, causing a
        // PHP fatal on any venue_id POST. Use Gssh_Radial_Obstruction_Profile
        // static methods directly, which is the correct API for profile lookup.
        // Fall back to Gssh_Stadium_Database::get_stadium() for lat/lng when the
        // radial profile is absent (venue exists in DB but has no LiDAR profile).
        $profile = null;

        if ( $venue_id ) {
            // Primary: radial obstruction profile (LiDAR-derived, most accurate)
            if ( Gssh_Radial_Obstruction_Profile::has_profile( $venue_id ) ) {
                $profile = Gssh_Radial_Obstruction_Profile::get_profile( $venue_id );
            }

            // If no radial profile, at least resolve lat/lng from the DB so the
            // estimated path has accurate coordinates even if caller omitted them.
            if ( $profile === null && ( ! $lat || ! $lng ) ) {
                $stadium = Gssh_Stadium_Database::get_stadium( $venue_id );
                if ( $stadium ) {
                    $loc = $stadium['location'] ?? [];
                    $lat = $lat ?: floatval( $loc['lat'] ?? 0 );
                    $lng = $lng ?: floatval( $loc['lng'] ?? $loc['lon'] ?? 0 );
                }
            }
        }

        if ( ! $lat || ! $lng ) {
            wp_send_json_error( array( 'message' => 'No venue or coordinates provided' ) );
            return;
        }

        $engine = new Gssh_Shade_Engine();
        $result = $engine->analyse( $lat, $lng, $date, $profile, $roof_state, $venue_id );

        wp_send_json_success( $result );
    }

    /**
     * Shade render - returns HTML/SVG for shade visualization
     * Supports modes: snapshot, animation, series, seasonal, heatmap
     */
    public function ajax_shade_render() {
        check_ajax_referer( 'gssh_hub_nonce', 'nonce' );
        $this->forward_hub_climate_data();
        $venue_id = sanitize_text_field( $_POST['venue_id'] ?? '' );
        $date     = sanitize_text_field( $_POST['date'] ?? date( 'Y-m-d' ) );
        $time     = sanitize_text_field( $_POST['time'] ?? '12:00' );
        $mode     = sanitize_text_field( $_POST['mode'] ?? 'series' );

        if ( ! $venue_id ) {
            wp_send_json_error( array( 'message' => 'No venue specified' ) );
            return;
        }

        // Verify venue exists
        $stadium = Gssh_Stadium_Database::get_stadium( $venue_id );
        if ( ! $stadium ) {
            wp_send_json_error( array( 'message' => 'Venue not found: ' . $venue_id ) );
            return;
        }

        try {
            $visualiser = new Gssh_Shade_Visualiser();
            $html = '';

            switch ( $mode ) {
                case 'snapshot':
                    $datetime = $date . 'T' . $time . ':00';
                    $html = $visualiser->generate_snapshot( $venue_id, $datetime, array(
                        'width'  => 800,
                        'height' => 500,
                    ) );
                    break;

                case 'animation':
                    $html = $visualiser->generate_daily_animation( $venue_id, $date, array(
                        'width'  => 800,
                        'height' => 500,
                    ) );
                    break;

                case 'series':
                    $html = $visualiser->generate_time_series( $venue_id, $date );
                    break;

                case 'seasonal':
                    $html = $visualiser->generate_seasonal_comparison( $venue_id, $time );
                    break;

                case 'heatmap':
                    $html = $visualiser->generate_shade_heatmap( $venue_id, $date, array(
                        'width'  => 800,
                        'height' => 500,
                    ) );
                    break;

                default:
                    $html = $visualiser->generate_time_series( $venue_id, $date );
            }

            wp_send_json_success( array(
                'html'     => $html,
                'venue_id' => $venue_id,
                'mode'     => $mode,
                'date'     => $date,
            ) );
        } catch ( \Throwable $e ) {
            wp_send_json_error( array(
                'message' => $e->getMessage(),
                'file'    => basename( $e->getFile() ),
                'line'    => $e->getLine(),
            ) );
        }
    }

    /**
     * Rig placement render - returns HTML for rig calculator results
     */
    public function ajax_rig_render() {
        check_ajax_referer( 'gssh_hub_nonce', 'nonce' );
        $this->forward_hub_climate_data();

        // Force opcache to reload modified files (safe no-op if opcache disabled)
        if ( function_exists( 'opcache_invalidate' ) ) {
            $plugin_dir = dirname( __FILE__ );
            opcache_invalidate( $plugin_dir . '/class-gssh-stadium-loader.php', true );
            opcache_invalidate( $plugin_dir . '/stadium/class-rig-placement-calculator.php', true );
            opcache_invalidate( $plugin_dir . '/stadium/class-dli-gap-calculator.php', true );
            opcache_invalidate( $plugin_dir . '/stadium/class-supplemental-light-module.php', true );
            opcache_invalidate( $plugin_dir . '/stadium/class-eue-calculator.php', true );
        }

        $venue_id  = sanitize_text_field( $_POST['venue_id'] ?? '' );
        $rig_model = sanitize_text_field( $_POST['rig_model'] ?? 'SGL_MU460' );
        $month     = intval( $_POST['month'] ?? date( 'n' ) );

        // b35fix250: roof state for retractable-roof venues.
        // Attenuates hub_ambient_dli before it reaches the rig calculator so
        // strategy classification reflects actual light reaching the surface.
        $allowed_roof_states = [ 'open', 'closed', 'unknown' ];
        $roof_state_rig = sanitize_text_field( $_POST['roof_state'] ?? 'open' );
        if ( ! in_array( $roof_state_rig, $allowed_roof_states, true ) ) {
            $roof_state_rig = 'open';
        }

        if ( ! $venue_id ) {
            wp_send_json_error( array( 'message' => 'No venue specified' ) );
            return;
        }

        $stadium = Gssh_Stadium_Database::get_stadium( $venue_id );
        if ( ! $stadium ) {
            wp_send_json_error( array( 'message' => 'Venue not found' ) );
            return;
        }

        // b35fix250: apply roof permeability to hub_ambient_dli.
        // With Marvel roof closed (permeability 0.3) and raw ambient ~40 mol,
        // attenuated ambient = 12 mol — correctly placing zones in deficit.
        // roof_tx = 1.0 for open roof or venues with no retractable roof → no change.
        $raw_hub_ambient_dli       = floatval( $_POST['ambient_dli'] ?? 0 ) ?: null;
        $roof_tx_rig               = Gssh_Shade_Engine::get_roof_transmission( $venue_id, $roof_state_rig );
        $attenuated_hub_ambient_dli = ( $raw_hub_ambient_dli !== null )
            ? round( $raw_hub_ambient_dli * $roof_tx_rig, 1 )
            : null;

        try {
            $calculator = new Gssh_Rig_Placement_Calculator();
            $visualiser = new Gssh_Rig_Placement_Visualiser();

            $target_coverage_pct = isset( $_POST['target_coverage_pct'] ) && $_POST['target_coverage_pct'] !== ''
                ? max( 0, min( 100, floatval( $_POST['target_coverage_pct'] ) ) )
                : null;

            $result = $calculator->calculate_rig_requirements( $venue_id, array(
                'rig_type'            => $rig_model,
                'month'               => $month,
                'hub_target_dli'      => floatval( $_POST['target_dli'] ?? 0 ) ?: null,
                'hub_ambient_dli'     => $attenuated_hub_ambient_dli,
                'variety'             => sanitize_text_field( $_POST['variety'] ?? 'tiftuf' ),
                'target_coverage_pct' => $target_coverage_pct,
                'hub_temperature'     => isset( $_POST['hub_temperature'] ) && $_POST['hub_temperature'] !== ''
                    ? floatval( $_POST['hub_temperature'] )
                    : null,
                'venue_environment'   => $this->sanitize_venue_environment( $_POST['venue_environment'] ?? array() ),
            ) );

            // DEBUG: Log what venue_env the calculator receives
            error_log( 'GSSH EUE venue_env: ' . json_encode( $result['_debug_venue_env'] ?? 'not set' ) );
            error_log( 'GSSH EUE result: composite=' . ( $result['eue']['composite_eue'] ?? 'N/A' ) );

            $html = $visualiser->generate_complete_analysis_view( $result );

            $response = array(
                'html'      => $html,
                'venue_id'  => $venue_id,
                'rig_model' => $rig_model,
            );

            // Include EUE data for JS-side consumption
            if ( isset( $result['eue'] ) ) {
                $response['eue'] = $result['eue'];
            }
            if ( isset( $result['venue_readiness'] ) ) {
                $response['venue_readiness'] = $result['venue_readiness'];
            }
            if ( isset( $result['summary'] ) ) {
                $response['summary'] = $result['summary'];
            }

            // DLI context for export report section heading and narrative
            // Prefer hub-provided values (live Open-Meteo) over shade-model seasonal estimates
            // b35fix250: use attenuated ambient DLI so report reflects roof-closed conditions
            $hub_ambient_dli = $attenuated_hub_ambient_dli;
            $hub_target_dli  = floatval( $_POST['target_dli'] ?? 0 ) ?: null;
            $response['dli_context'] = array(
                'analysis_month'      => $result['analysis_month'] ?? $month,
                'analysis_month_name' => $result['analysis_month_name'] ?? date( 'F', mktime( 0, 0, 0, $month, 1 ) ),
                'target_dli'          => $hub_target_dli ?? $result['target_dli'] ?? null,
                'ambient_dli'         => $hub_ambient_dli ?? $result['shade_analysis']['ambient_dli'] ?? $result['deficit_zones']['ambient_dli'] ?? null,
                'total_deficit_area'  => $result['deficit_zones']['total_deficit_area'] ?? null,
                'variety'             => sanitize_text_field( $_POST['variety'] ?? $result['variety'] ?? '' ),
                'strategy'            => $result['placements']['strategy'] ?? $result['summary']['strategy'] ?? null,
            );

            // Debug: show what venue_env PHP actually processed
            $raw_env = $_POST['venue_environment'] ?? 'NOT_SET';
            $sanitised_env = $this->sanitize_venue_environment( $_POST['venue_environment'] ?? array() );
            $response['_debug'] = array(
                'raw_venue_env'       => $raw_env,
                'sanitised_venue_env' => $sanitised_env,
                'opcache_status'      => function_exists( 'opcache_get_status' ) ? 'enabled' : 'disabled',
            );

            wp_send_json_success( $response );
        } catch ( \Throwable $e ) {
            wp_send_json_error( array( 'message' => $e->getMessage() ) );
        }
    }

    /**
     * Seasonal planner render - returns HTML for monthly lighting schedule
     */
    public function ajax_planner_render() {
        check_ajax_referer( 'gssh_hub_nonce', 'nonce' );
        $this->forward_hub_climate_data();

        $venue_id  = sanitize_text_field( $_POST['venue_id'] ?? '' );
        $rig_model = sanitize_text_field( $_POST['rig_model'] ?? 'SGL_MU460' );
        $currency  = sanitize_text_field( $_POST['currency'] ?? 'AUD' );
        $kwh_rate  = floatval( $_POST['kwh_rate'] ?? 0.30 );

        if ( ! $venue_id ) {
            wp_send_json_error( array( 'message' => 'No venue specified' ) );
            return;
        }

        $stadium = Gssh_Stadium_Database::get_stadium( $venue_id );
        if ( ! $stadium ) {
            wp_send_json_error( array( 'message' => 'Venue not found' ) );
            return;
        }

        try {
            $calculator = new Gssh_Rig_Placement_Calculator();
            $visualiser = new Gssh_Rig_Placement_Visualiser();

            $result = $calculator->calculate_seasonal_requirements( $venue_id, array(
                'rig_type'  => $rig_model,
                'currency'  => $currency,
                'elec_rate' => $kwh_rate,
            ) );

            $html = $visualiser->generate_seasonal_analysis_view( $result );

            // Build structured month array for JS export module
            $monthly_export = [];
            foreach ( $result['monthly_analysis'] ?? [] as $month_num => $mdata ) {
                $cost_data = $result['cost_analysis']['monthly_costs'][ $month_num ] ?? null;
                $monthly_export[] = [
                    'month'          => (int) $month_num,
                    'month_name'     => $mdata['month_name'] ?? '',
                    'rigs_required'  => $mdata['rigs_required'] ?? 0,
                    'hours_per_day'  => $mdata['rig_hours_per_day'] ?? 0,
                    'ambient_dli'    => $mdata['ambient_dli'] ?? null,
                    'target_dli'     => $mdata['target_dli'] ?? null,
                    'kwh'            => $cost_data ? $cost_data['kwh'] : null,
                    'cost'           => $cost_data ? $cost_data['cost'] : null,
                    'cost_formatted' => $cost_data ? $cost_data['cost_formatted'] : null,
                ];
            }

            $cost = $result['cost_analysis'] ?? [];

            wp_send_json_success( array(
                'html'             => $html,
                'venue_id'         => $venue_id,
                'rig_model'        => $rig_model,
                'currency'         => $currency,
                'kwh_rate'         => $kwh_rate,
                'months'           => $monthly_export,
                'annual'           => [
                    'total_kwh'    => $cost['total_kwh'] ?? null,
                    'total_cost'   => $cost['total_cost'] ?? null,
                    'total_formatted' => $cost['total_formatted'] ?? null,
                    'power_kw'     => $cost['power_kw'] ?? null,
                ],
                'summary'          => $result['seasonal_summary'] ?? null,
            ) );
        } catch ( \Throwable $e ) {
            wp_send_json_error( array( 'message' => $e->getMessage() ) );
        }
    }

    /**
     * Get stadium details
     */
    public function ajax_get_stadium() {
        $venue_id = sanitize_text_field( $_GET['venue_id'] ?? $_POST['venue_id'] ?? '' );

        $db = new Gssh_Stadium_Database( $this->data_dir );
        $stadium = $db->get_stadium( $venue_id );

        if ( ! $stadium ) {
            wp_send_json_error( array( 'message' => 'Stadium not found' ) );
            return;
        }

        wp_send_json_success( $stadium );
    }

    /**
     * Delete custom venue
     */
    public function ajax_delete_custom_venue() {
        check_ajax_referer( 'gssh_hub_nonce', 'nonce' );

        if ( ! is_user_logged_in() ) {
            wp_send_json_error( array( 'message' => 'Authentication required' ) );
            return;
        }

        $venue_id = sanitize_key( $_POST['venue_id'] ?? '' );
        if ( ! $venue_id ) {
            wp_send_json_error( array( 'message' => 'Missing venue_id' ) );
            return;
        }

        // Only allow deleting custom (user-added) venues, not built-in ones
        if ( ! Gssh_Stadium_Database::is_custom_stadium( $venue_id ) ) {
            wp_send_json_error( array( 'message' => 'Cannot delete built-in venue' ) );
            return;
        }

        $result = Gssh_Stadium_Database::delete_custom_stadium( $venue_id );
        if ( $result ) {
            wp_send_json_success( array( 'deleted' => $venue_id ) );
        } else {
            wp_send_json_error( array( 'message' => 'Delete failed' ) );
        }
    }

    /**
     * Save turf profile for a venue (GSSH only)
     * Stored in wp_options as gssh_venue_profiles, keyed by venue_id.
     */
    public function ajax_save_venue_profile() {
        check_ajax_referer( 'gssh_hub_nonce', 'nonce' );
        if ( ! is_user_logged_in() ) {
            wp_send_json_error( array( 'message' => 'Authentication required' ) );
            return;
        }

        $venue_id = sanitize_key( $_POST['venue_id'] ?? '' );
        if ( ! $venue_id ) {
            wp_send_json_error( array( 'message' => 'Missing venue_id' ) );
            return;
        }

        // b35fix253: persist EUE venue environment config so settings survive hard reset.
        // venueEnv is passed as JSON string — FormData cannot nest objects natively.
        $venue_env_raw = isset( $_POST['venueEnv'] ) ? wp_unslash( $_POST['venueEnv'] ) : '';
        $venue_env     = array();
        if ( ! empty( $venue_env_raw ) ) {
            $decoded = json_decode( $venue_env_raw, true );
            if ( is_array( $decoded ) ) {
                $allowed_enclosure = [ 'open', 'partial', 'retractable_open', 'retractable_closed',
                                       'fixed_roof', 'enclosed', 'enclosed_enriched' ];
                $allowed_co2       = [ 'none', 'ventilation_schedule', 'enrichment' ];
                $allowed_goal      = [ 'maintenance', 'strengthening', 'recovery', 'establishment' ];
                $venue_env = array(
                    'enclosureType'            => in_array( $decoded['enclosureType'] ?? '', $allowed_enclosure, true )
                                                  ? $decoded['enclosureType'] : 'open',
                    'drainageRating'           => isset( $decoded['drainageRating'] ) && is_numeric( $decoded['drainageRating'] )
                                                  ? round( floatval( $decoded['drainageRating'] ), 2 ) : null,
                    'hocMM'                    => isset( $decoded['hocMM'] ) && is_numeric( $decoded['hocMM'] )
                                                  ? intval( $decoded['hocMM'] ) : null,
                    'managementGoal'           => in_array( $decoded['managementGoal'] ?? '', $allowed_goal, true )
                                                  ? $decoded['managementGoal'] : 'maintenance',
                    'hasFans'                  => ! empty( $decoded['hasFans'] ),
                    'estimatedAirflowMs'       => isset( $decoded['estimatedAirflowMs'] ) && is_numeric( $decoded['estimatedAirflowMs'] )
                                                  ? floatval( $decoded['estimatedAirflowMs'] ) : null,
                    'co2Management'            => in_array( $decoded['co2Management'] ?? '', $allowed_co2, true )
                                                  ? $decoded['co2Management'] : 'none',
                    'co2ppm'                   => isset( $decoded['co2ppm'] ) && is_numeric( $decoded['co2ppm'] )
                                                  ? intval( $decoded['co2ppm'] ) : null,
                    'hasSubSoilHeating'        => ! empty( $decoded['hasSubSoilHeating'] ),
                    'irrigationAdjustedForLED' => ! empty( $decoded['irrigationAdjustedForLED'] ),
                    'overseedActive'           => array_key_exists( 'overseedActive', $decoded )
                                                  ? ( is_null( $decoded['overseedActive'] ) ? null : (bool) $decoded['overseedActive'] )
                                                  : null,
                );
            }
        }

        $profile = array(
            'turfType'        => sanitize_text_field( $_POST['turfType']        ?? '' ),
            'subCategory'     => sanitize_text_field( $_POST['subCategory']     ?? '' ),
            'species'         => sanitize_text_field( $_POST['species']         ?? '' ),
            'variety'         => sanitize_text_field( $_POST['variety']         ?? '' ),
            'construction'    => sanitize_text_field( $_POST['construction']    ?? '' ),
            // b35fix256: persist overseed species/variety and % C3 cover
            'overseedSpecies' => sanitize_text_field( $_POST['overseedSpecies'] ?? '' ),
            'overseedVariety' => sanitize_text_field( $_POST['overseedVariety'] ?? '' ),
            'percentC3Cover'  => isset( $_POST['percentC3Cover'] ) && is_numeric( $_POST['percentC3Cover'] )
                                  ? max( 0, min( 100, floatval( $_POST['percentC3Cover'] ) ) ) : 0,
            'venueEnv'        => $venue_env,
            '_saved'          => current_time( 'mysql' ),
        );

        $all_profiles = get_option( 'gssh_venue_profiles', array() );
        $all_profiles[ $venue_id ] = $profile;
        update_option( 'gssh_venue_profiles', $all_profiles );

        wp_send_json_success( array( 'venue_id' => $venue_id, 'profile' => $profile ) );
    }

    /**
     * Get all saved venue turf profiles (GSSH only)
     */
    public function ajax_get_venue_profiles() {
        check_ajax_referer( 'gssh_hub_nonce', 'nonce' );
        if ( ! is_user_logged_in() ) {
            wp_send_json_error( array( 'message' => 'Authentication required' ) );
            return;
        }
        $all_profiles = get_option( 'gssh_venue_profiles', array() );
        wp_send_json_success( $all_profiles );
    }

    /**
     * Save custom venue
     */
    public function ajax_save_custom_venue() {
        check_ajax_referer( 'gssh_hub_nonce', 'nonce' );

        if ( ! is_user_logged_in() ) {
            wp_send_json_error( array( 'message' => 'Authentication required' ) );
            return;
        }

        $venue_data = array(
            'name'        => sanitize_text_field( $_POST['name'] ?? '' ),
            'lat'         => floatval( $_POST['lat'] ?? 0 ),
            'lng'         => floatval( $_POST['lng'] ?? 0 ),
            'orientation' => floatval( $_POST['orientation'] ?? 0 ),
            'length'      => floatval( $_POST['length'] ?? 105 ),
            'width'       => floatval( $_POST['width'] ?? 68 ),
            'stands'      => json_decode( stripslashes( $_POST['stands'] ?? '{}' ), true ),
            'user_id'     => get_current_user_id(),
        );

        $db = new Gssh_Stadium_Database( $this->data_dir );
        $result = $db->save_custom_venue( $venue_data );

        wp_send_json_success( $result );
    }

    /**
     * Track rig effectiveness
     */
    public function ajax_track_effectiveness() {
        check_ajax_referer( 'gssh_hub_nonce', 'nonce' );

        $tracker = new Gssh_Effectiveness_Tracker();
        $result = $tracker->record( $_POST );

        wp_send_json_success( $result );
    }

    // =========================================================================
    // ASSET ENQUEUE (called from main plugin)
    // =========================================================================

    /**
     * Enqueue stadium-specific JS and CSS
     * Called from gssh_hub_enqueue_assets() in main plugin file
     */
    public static function enqueue_assets( $plugin_url ) {
        // Stadium CSS
        $css_dir = $plugin_url . '/assets/stadium/css/';
        $css_files = glob( dirname( dirname( __FILE__ ) ) . '/assets/stadium/css/*.css' );
        foreach ( $css_files as $css_file ) {
            $handle = 'gssh-stadium-' . basename( $css_file, '.css' );
            wp_enqueue_style(
                $handle,
                $css_dir . basename( $css_file ),
                array( 'gssh-hub-css' ),
                gilba_asset_version( 'assets/stadium/css/' . basename( $css_file ) , GSSH_HUB_VERSION )
            );
        }

        // Stadium JS - venue selector
        wp_enqueue_script(
            'gssh-unified-venue-selector',
            $plugin_url . '/assets/stadium/unified-venue-selector.js',
            array( 'gssh-hub-js', 'gssh-site-config', 'gssh-site-context' ), // b35fix271: site-context must load before venue selector
            gilba_asset_version( 'assets/stadium/unified-venue-selector.js', GSSH_HUB_VERSION ),
            true
        );
        // b35fix264: initialise GSSH_CONTEXT before venue selector runs.
        // unified-venue-selector.js guards writes with `if (global.GSSH_CONTEXT)` —
        // without this the object never exists and all venue coord/species writes silently fail.
        wp_add_inline_script( 'gssh-unified-venue-selector', 'window.GSSH_CONTEXT = window.GSSH_CONTEXT || {};', 'before' );

        // Stadium JS - venue turf profile persistence (save/restore per-venue turf settings)
        wp_enqueue_script(
            'gssh-venue-profile-persistence',
            $plugin_url . '/assets/stadium/venue-profile-persistence.js',
            array( 'gssh-unified-venue-selector' ),
            gilba_asset_version( 'assets/stadium/venue-profile-persistence.js', GSSH_HUB_VERSION ),
            true
        );

        // b35fix253: inject stadium defaults for venue env pre-population on fresh/reset load.
        // Only venues with a 'defaults' key in the DB are included — keeps the payload minimal.
        $stadium_defaults = array();
        $all_ids = Gssh_Stadium_Database::get_stadium_ids();
        foreach ( $all_ids as $venue_id ) {
            $stadium = Gssh_Stadium_Database::get_stadium( $venue_id );
            if ( ! empty( $stadium['defaults'] ) ) {
                $stadium_defaults[ $venue_id ] = $stadium['defaults'];
            }
        }
        wp_localize_script( 'gssh-venue-profile-persistence', 'GSSH_STADIUM_DEFAULTS', $stadium_defaults );

        // Stadium JS - coverage slider
        wp_enqueue_script(
            'gssh-coverage-slider',
            $plugin_url . '/assets/stadium/coverage-slider.js',
            array( 'gssh-hub-js' ),
            gilba_asset_version( 'assets/stadium/coverage-slider.js', GSSH_HUB_VERSION ),
            true
        );

        // Shade orchestrator (new bridge replacement)
        wp_enqueue_script(
            'gssh-shade-orchestrator',
            $plugin_url . '/assets/shade-orchestrator.js',
            array( 'gssh-hub-orchestrator', 'gssh-shade-engine', 'gssh-unified-venue-selector' ),
            gilba_asset_version( 'assets/shade-orchestrator.js', GSSH_HUB_VERSION ),
            true
        );

        // Stadium tab UI
        wp_enqueue_script(
            'gssh-stadium-tab-ui',
            $plugin_url . '/assets/stadium-tab-ui.js',
            array( 'gssh-shade-orchestrator', 'gssh-tab-navigation' ),
            gilba_asset_version( 'assets/stadium-tab-ui.js', GSSH_HUB_VERSION ),
            true
        );

        // Localize stadium data — pass all venue configs to JS
        $all_stadiums = Gssh_Stadium_Database::get_all_stadiums();

        wp_localize_script(
            'gssh-unified-venue-selector',
            'GSSH_STADIUM_CONFIG',
            array(
                'venues'  => $all_stadiums,
                'ajaxUrl' => admin_url( 'admin-ajax.php' ),
                'nonce'   => wp_create_nonce( 'gssh_hub_nonce' ),
            )
        );

        // Also expose as GilbaStadiumData for unified-venue-selector compatibility
        wp_localize_script(
            'gssh-unified-venue-selector',
            'GilbaStadiumData',
            array(
                'stadiums' => $all_stadiums,
            )
        );
    }

    /**
     * Get list of stadium venue IDs grouped by region
     */
    public function get_venues_by_region() {
        $db = new Gssh_Stadium_Database( $this->data_dir );
        return $db->group_venues_by_region();
    }

    /**
     * Sanitise venue environment config from POST data.
     * 
     * Normalises camelCase JS keys to snake_case PHP keys.
     * v2.1.0 - Key normalisation fix for EUE integration (2026-03-01)
     */
    private function sanitize_venue_environment( $raw ) {
        if ( ! is_array( $raw ) ) {
            return array();
        }

        // Map camelCase JS keys to snake_case PHP keys
        $key_map = array(
            'enclosureType'           => 'enclosure_type',
            'drainageRating'          => 'drainage_rating',
            'hocMM'                   => 'hoc_mm',
            'managementGoal'          => 'management_goal',
            'hasFans'                 => 'has_fans',
            'estimatedAirflowMs'      => 'estimated_airflow_ms',
            'co2Management'           => 'co2_management',
            'co2ppm'                  => 'co2_ppm',
            'hasSubSoilHeating'       => 'has_sub_soil_heating',
            'irrigationAdjustedForLED' => 'irrigation_adjusted_for_led',
            'humidityPct'             => 'humidity_pct',
            'soilMoisturePct'         => 'soil_moisture_pct',
        );

        $sanitised = array();
        foreach ( $raw as $key => $value ) {
            $key = sanitize_text_field( $key );
            // Normalise camelCase to snake_case
            $normalised = isset( $key_map[ $key ] ) ? $key_map[ $key ] : $key;
            // Only allow known keys
            if ( ! in_array( $normalised, array_values( $key_map ), true ) && ! in_array( $normalised, array_keys( $key_map ), true ) ) {
                continue;
            }
            $sanitised[ $normalised ] = sanitize_text_field( $value );
        }

        return $sanitised;
    }
}
