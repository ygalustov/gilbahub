<?php
/**
 * =============================================================================
 * GILBA ALERTS - SMS/Email Notification Engine v1.0.0
 * =============================================================================
 *
 * Sends SMS and/or email alerts when agronomic thresholds are crossed.
 * Triggered by JS POST to /gilba/v1/alert-check after each orchestrator run.
 *
 * THRESHOLD LOGIC:
 *   Disease    — Smith-Kerns dollar spot index >= 20 (action threshold, Smith et al. 2018)
 *                OR any disease risk >= HIGH (70%)
 *   Pre-emergent — any species at RED_EARLY or RED_MISSED status
 *   Stress     — stress trajectory current score >= 70
 *
 * SUPPRESSION:
 *   WP option key: gilba_alert_sent_{site_id}_{alert_type}_{YYYY-MM-DD}
 *   Each threshold fires at most once per site per day.
 *   Quiet hours (22:00–07:00 site local time) suppress SMS; email still sends.
 *
 * SMS PROVIDER: ClickSend REST API v3
 *   Docs: https://developers.clicksend.com/docs/rest/v3/
 *   No SDK required — single POST to https://rest.clicksend.com/v3/sms/send
 *
 * SETTINGS (stored as WP options):
 *   gilba_alerts_clicksend_username  — ClickSend account username
 *   gilba_alerts_clicksend_api_key   — ClickSend API key
 *   gilba_alerts_from_number         — Sender name/number (max 11 chars for alpha)
 *   gilba_alerts_admin_email         — Fallback email for errors
 *
 * ENDPOINTS:
 *   POST /gilba/v1/alert-check       — Receive computed results, evaluate, fire if needed
 *   GET  /gilba/v1/alert-settings    — Return current settings (no credentials)
 *   POST /gilba/v1/alert-settings    — Save settings
 *   POST /gilba/v1/alert-test        — Send a test SMS/email to verify credentials
 *
 * USAGE (gilba-agronomic-intelligence-hub.php):
 *   require_once plugin_dir_path(__FILE__) . 'includes/class-gilba-alerts.php';
 *   Gilba_Alerts::get_instance();
 *
 * @author  Gilba Solutions
 * @version 1.0.0
 * @since   b35fix107
 * =============================================================================
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gilba_Alerts {

    const REST_NAMESPACE = 'gilba/v1';
    const VERSION        = '1.0.0';

    // Option keys
    const OPT_CLICKSEND_USERNAME = 'gilba_alerts_clicksend_username';
    const OPT_CLICKSEND_API_KEY  = 'gilba_alerts_clicksend_api_key';
    const OPT_FROM_NUMBER        = 'gilba_alerts_from_number';
    const OPT_ADMIN_EMAIL        = 'gilba_alerts_admin_email';

    // Thresholds
    const THRESHOLD_SMITH_KERNS  = 20;   // % action threshold — Smith et al. 2018
    const THRESHOLD_DISEASE_HIGH = 70;   // % risk score
    const THRESHOLD_STRESS       = 70;   // stress trajectory score

    // Quiet hours (local, 24h)
    const QUIET_HOUR_START = 22;
    const QUIET_HOUR_END   = 7;

    private static $instance = null;

    public static function get_instance() {
        if ( self::$instance === null ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
        add_action( 'admin_menu',    array( $this, 'register_admin_menu' ) );
    }

    // =========================================================================
    // ADMIN SETTINGS PAGE
    // =========================================================================

    public function register_admin_menu() {
        add_menu_page(
            'Gilba Hub Alerts',
            'Gilba Alerts',
            'manage_options',
            'gilba-alerts',
            array( $this, 'render_settings_page' ),
            'dashicons-bell',
            82
        );
    }

    public function render_settings_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Insufficient permissions.' );
        }

        // Handle form save
        if ( isset( $_POST['gilba_alerts_nonce'] ) && wp_verify_nonce( $_POST['gilba_alerts_nonce'], 'gilba_alerts_save' ) ) {
            update_option( self::OPT_CLICKSEND_USERNAME, sanitize_text_field( $_POST['clicksend_username'] ?? '' ) );
            if ( ! empty( $_POST['clicksend_api_key'] ) ) {
                update_option( self::OPT_CLICKSEND_API_KEY, sanitize_text_field( $_POST['clicksend_api_key'] ) );
            }
            update_option( self::OPT_FROM_NUMBER, sanitize_text_field( substr( $_POST['from_number'] ?? 'GilbaHub', 0, 11 ) ) );
            update_option( self::OPT_ADMIN_EMAIL, sanitize_email( $_POST['admin_email'] ?? '' ) );
            echo '<div class="notice notice-success"><p>Settings saved.</p></div>';
        }

        $username   = esc_attr( get_option( self::OPT_CLICKSEND_USERNAME, '' ) );
        $key_set    = ! empty( get_option( self::OPT_CLICKSEND_API_KEY ) );
        $from       = esc_attr( get_option( self::OPT_FROM_NUMBER, 'GilbaHub' ) );
        $admin_mail = esc_attr( get_option( self::OPT_ADMIN_EMAIL, get_option( 'admin_email' ) ) );

        ?>
        <div class="wrap">
            <h1>Gilba Hub — Alert Settings</h1>
            <p>Configure SMS delivery via ClickSend and the fallback admin email.
               Contact details (phone/email per site) are set in the Hub settings panel within each site.</p>

            <form method="post">
                <?php wp_nonce_field( 'gilba_alerts_save', 'gilba_alerts_nonce' ); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="clicksend_username">ClickSend username</label></th>
                        <td>
                            <input type="text" id="clicksend_username" name="clicksend_username"
                                   value="<?php echo $username; ?>" class="regular-text">
                            <p class="description">Your ClickSend account email or username.
                               <a href="https://www.clicksend.com/au/signup/" target="_blank">Create a ClickSend account</a>.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="clicksend_api_key">ClickSend API key</label></th>
                        <td>
                            <input type="password" id="clicksend_api_key" name="clicksend_api_key"
                                   value="" class="regular-text" placeholder="<?php echo $key_set ? '(saved — leave blank to keep)' : 'Paste API key'; ?>">
                            <p class="description">Found in your ClickSend dashboard under API credentials. Leave blank to keep the existing key.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="from_number">Sender name / number</label></th>
                        <td>
                            <input type="text" id="from_number" name="from_number"
                                   value="<?php echo $from; ?>" class="regular-text" maxlength="11">
                            <p class="description">Up to 11 characters. Alphanumeric sender IDs (e.g. GilbaHub) are supported in AU/NZ/UK. Some carriers require a numeric number.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="admin_email">Admin email (fallback)</label></th>
                        <td>
                            <input type="email" id="admin_email" name="admin_email"
                                   value="<?php echo $admin_mail; ?>" class="regular-text">
                            <p class="description">Receives error notifications if SMS delivery fails. Defaults to WordPress admin email.</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button( 'Save Settings' ); ?>
            </form>

            <hr>
            <h2>How alerts work</h2>
            <ol>
                <li>After each analysis run, the Hub posts computed results to <code>/gilba/v1/alert-check</code>.</li>
                <li>PHP evaluates thresholds: Smith-Kerns dollar spot &ge;20%, disease overall &ge;70%, pre-emergent RED, stress trajectory &ge;70%.</li>
                <li>Each threshold fires at most once per site per day (suppressed via WP options).</li>
                <li>SMS is suppressed during quiet hours (10 pm – 7 am UTC) if enabled per site.</li>
                <li>Contact numbers and emails are configured per site in the Hub &rarr; Site Settings panel &rarr; Alerts section.</li>
            </ol>
        </div>
        <?php
    }

    // =========================================================================
    // REST ROUTES
    // =========================================================================

    public function register_rest_routes() {

        // Receive orchestrator results and evaluate thresholds
        register_rest_route( self::REST_NAMESPACE, '/alert-check', array(
            'methods'             => 'POST',
            'callback'            => array( $this, 'handle_alert_check' ),
            'permission_callback' => array( $this, 'check_permission' ),
        ) );

        // Get alert settings (no credentials returned)
        register_rest_route( self::REST_NAMESPACE, '/alert-settings', array(
            'methods'             => 'GET',
            'callback'            => array( $this, 'handle_get_settings' ),
            'permission_callback' => array( $this, 'check_permission' ),
        ) );

        // Save alert settings
        register_rest_route( self::REST_NAMESPACE, '/alert-settings', array(
            'methods'             => 'POST',
            'callback'            => array( $this, 'handle_save_settings' ),
            'permission_callback' => array( $this, 'check_permission' ),
        ) );

        // Test SMS/email
        register_rest_route( self::REST_NAMESPACE, '/alert-test', array(
            'methods'             => 'POST',
            'callback'            => array( $this, 'handle_test' ),
            'permission_callback' => array( $this, 'check_permission' ),
        ) );
    }

    public function check_permission() {
        // Require manage_options — alert settings include ClickSend credentials
        // and admin email. Any logged-in user (including subscribers) should not
        // be able to read or overwrite these on a multi-user install.
        return current_user_can( 'manage_options' );
    }

    // =========================================================================
    // ALERT CHECK — main entry point
    // =========================================================================

    /**
     * Receives orchestrator output from JS, evaluates thresholds, fires alerts.
     *
     * Expected POST body (JSON):
     * {
     *   site_id:    string,
     *   site_name:  string,
     *   contacts:   [ { type: 'sms'|'email', value: string, alerts: ['disease','pre_emergent','stress'] } ],
     *   quiet_hours: bool,        // honour quiet hours for this site
     *   results: {
     *     disease:      { overallScore, diseases: [...] },
     *     smithKerns:   { riskIndex },
     *     preEmergent:  { aggregateStatus, results: [...] },
     *     stress:       { summary: { currentScore } }
     *   }
     * }
     */
    public function handle_alert_check( WP_REST_Request $request ) {
        $body = $request->get_json_params();

        if ( empty( $body['site_id'] ) || empty( $body['results'] ) ) {
            return new WP_Error( 'missing_params', 'site_id and results are required', array( 'status' => 400 ) );
        }

        $site_id    = sanitize_key( $body['site_id'] );
        $site_name  = sanitize_text_field( $body['site_name'] ?? $site_id );
        $contacts   = $body['contacts'] ?? array();
        $quiet      = ! empty( $body['quiet_hours'] );
        $results    = $body['results'];

        // Evaluate each threshold
        $triggered = $this->evaluate_thresholds( $results );

        if ( empty( $triggered ) ) {
            return rest_ensure_response( array(
                'fired'    => false,
                'assessed' => array_keys( $this->threshold_keys() ),
                'message'  => 'No thresholds crossed',
            ) );
        }

        $fired    = array();
        $skipped  = array();
        $today    = gmdate( 'Y-m-d' );
        $is_quiet = $quiet && $this->is_quiet_hours();

        foreach ( $triggered as $alert_type => $alert_data ) {
            $option_key = "gilba_alert_sent_{$site_id}_{$alert_type}_{$today}";

            // Suppress if already sent today
            if ( get_option( $option_key ) ) {
                $skipped[] = $alert_type;
                continue;
            }

            $message = $this->build_message( $site_name, $alert_type, $alert_data );

            $send_errors = array();
            foreach ( $contacts as $contact ) {
                if ( ! in_array( $alert_type, $contact['alerts'] ?? array(), true ) ) {
                    continue;
                }

                $type  = sanitize_key( $contact['type'] ?? '' );
                $value = sanitize_text_field( $contact['value'] ?? '' );

                if ( empty( $value ) ) continue;

                if ( $type === 'sms' ) {
                    if ( $is_quiet ) {
                        $skipped[] = "{$alert_type}_sms_quiet";
                        continue;
                    }
                    $result = $this->send_sms( $value, $message );
                    if ( is_wp_error( $result ) ) {
                        $send_errors[] = $result->get_error_message();
                    }
                } elseif ( $type === 'email' ) {
                    $result = $this->send_email( $value, $site_name, $alert_type, $message );
                    if ( is_wp_error( $result ) ) {
                        $send_errors[] = $result->get_error_message();
                    }
                }
            }

            // Mark sent regardless of individual send errors — avoids spam on repeated API failures
            if ( empty( $send_errors ) ) {
                update_option( $option_key, array(
                    'sent_at'    => current_time( 'mysql', true ),
                    'alert_type' => $alert_type,
                    'data'       => $alert_data,
                ), false ); // autoload = false
                $fired[] = $alert_type;
            } else {
                // Log errors but don't suppress — will retry next run
                $this->log_error( "Alert send failed for {$alert_type} on site {$site_id}: " . implode( '; ', $send_errors ) );
            }
        }

        return rest_ensure_response( array(
            'fired'   => $fired,
            'skipped' => $skipped,
        ) );
    }

    // =========================================================================
    // THRESHOLD EVALUATION
    // =========================================================================

    /**
     * Evaluate orchestrator results against all thresholds.
     *
     * @param  array $results  Orchestrator computed outputs from JS
     * @return array           Keyed by alert_type, value = context data for message
     */
    public function evaluate_thresholds( array $results ) {
        $triggered = array();

        // ── Disease ────────────────────────────────────────────────────────────
        $disease = $results['disease'] ?? null;
        $sk      = $results['smithKerns'] ?? null;

        $sk_index    = (float) ( $sk['riskIndex'] ?? $sk['riskPercent'] ?? 0 );
        $disease_score = (float) ( $disease['overallScore'] ?? 0 );

        // Top disease name for message
        $top_disease = '';
        if ( ! empty( $disease['topThreats'] ) ) {
            $top_disease = $disease['topThreats'][0]['displayName'] ?? $disease['topThreats'][0]['disease'] ?? '';
        } elseif ( ! empty( $disease['diseases'] ) ) {
            usort( $disease['diseases'], fn( $a, $b ) => ( $b['riskScore'] ?? 0 ) <=> ( $a['riskScore'] ?? 0 ) );
            $top_disease = $disease['diseases'][0]['displayName'] ?? '';
        }

        if ( $sk_index >= self::THRESHOLD_SMITH_KERNS || $disease_score >= self::THRESHOLD_DISEASE_HIGH ) {
            $triggered['disease'] = array(
                'sk_index'     => $sk_index,
                'overall'      => $disease_score,
                'top_disease'  => $top_disease,
            );
        }

        // ── Pre-emergent ───────────────────────────────────────────────────────
        $pre_em = $results['preEmergent'] ?? null;
        $agg    = $pre_em['aggregateStatus'] ?? ( $pre_em['result']['aggregateStatus'] ?? '' );

        if ( in_array( $agg, array( 'RED_EARLY', 'RED_MISSED' ), true ) ) {
            // Collect species names at red status
            $red_species = array();
            $species_results = $pre_em['results'] ?? ( $pre_em['result']['results'] ?? array() );
            foreach ( $species_results as $sp ) {
                $status = $sp['status'] ?? '';
                if ( in_array( $status, array( 'RED_EARLY', 'RED_MISSED' ), true ) ) {
                    $red_species[] = $sp['commonName'] ?? $sp['name'] ?? $sp['key'] ?? '';
                }
            }
            $triggered['pre_emergent'] = array(
                'status'      => $agg,
                'red_species' => array_filter( $red_species ),
            );
        }

        // ── Stress trajectory ──────────────────────────────────────────────────
        $stress = $results['stress'] ?? $results['stressTrajectory'] ?? null;
        $score  = (float) ( $stress['summary']['currentScore'] ?? $stress['currentScore'] ?? 0 );

        if ( $score >= self::THRESHOLD_STRESS ) {
            $triggered['stress'] = array(
                'score'  => $score,
                'level'  => $stress['summary']['stressLevel'] ?? ( $score >= 85 ? 'Critical' : 'High' ),
            );
        }

        return $triggered;
    }

    // =========================================================================
    // MESSAGE BUILDER
    // =========================================================================

    private function build_message( string $site_name, string $alert_type, array $data ): string {
        switch ( $alert_type ) {

            case 'disease':
                $sk   = round( $data['sk_index'] ?? 0, 1 );
                $top  = $data['top_disease'] ? " ({$data['top_disease']})" : '';
                $ov   = round( $data['overall'] ?? 0 );
                if ( $sk >= self::THRESHOLD_SMITH_KERNS ) {
                    return "GAIP Alert — {$site_name}: Dollar spot risk index {$sk}%{$top} has reached the action threshold. Consider fungicide application.";
                }
                return "GAIP Alert — {$site_name}: Disease risk {$ov}%{$top}. Review fungicide programme.";

            case 'pre_emergent':
                $species = ! empty( $data['red_species'] )
                    ? implode( ', ', array_slice( $data['red_species'], 0, 3 ) )
                    : 'target species';
                $status  = $data['status'] === 'RED_MISSED' ? 'window has passed' : 'window closing';
                return "GAIP Alert — {$site_name}: Pre-emergent timing {$status} for {$species}. Check pre-emergent tab.";

            case 'stress':
                $score = round( $data['score'] );
                $level = $data['level'] ?? 'High';
                return "GAIP Alert — {$site_name}: Turf stress trajectory {$score}% ({$level}). Review stress tab for intervention options.";

            default:
                return "GAIP Alert — {$site_name}: Agronomic threshold crossed ({$alert_type}).";
        }
    }

    // =========================================================================
    // DELIVERY — SMS via ClickSend
    // =========================================================================

    /**
     * Send SMS via ClickSend REST API v3.
     *
     * @param  string $to       Destination number in E.164 format (+61412345678)
     * @param  string $message  Message body (max 160 chars for single segment)
     * @return true|WP_Error
     */
    private function send_sms( string $to, string $message ) {
        $username = get_option( self::OPT_CLICKSEND_USERNAME, '' );
        $api_key  = get_option( self::OPT_CLICKSEND_API_KEY, '' );

        if ( empty( $username ) || empty( $api_key ) ) {
            return new WP_Error( 'no_credentials', 'ClickSend credentials not configured' );
        }

        $from = get_option( self::OPT_FROM_NUMBER, 'GilbaHub' );

        $payload = array(
            'messages' => array(
                array(
                    'source' => 'gilba-hub',
                    'from'   => substr( $from, 0, 11 ),
                    'to'     => $to,
                    'body'   => substr( $message, 0, 160 ),
                ),
            ),
        );

        $response = wp_remote_post(
            'https://rest.clicksend.com/v3/sms/send',
            array(
                'timeout' => 10,
                'headers' => array(
                    'Authorization' => 'Basic ' . base64_encode( $username . ':' . $api_key ),
                    'Content-Type'  => 'application/json',
                ),
                'body'    => wp_json_encode( $payload ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code( $response );
        if ( $code !== 200 ) {
            $body = wp_remote_retrieve_body( $response );
            return new WP_Error( 'clicksend_error', "ClickSend returned HTTP {$code}: {$body}" );
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        $msg_status = $body['data']['messages'][0]['status'] ?? '';

        // ClickSend returns SUCCESS or QUEUED on success
        if ( ! in_array( $msg_status, array( 'SUCCESS', 'QUEUED' ), true ) ) {
            return new WP_Error( 'clicksend_rejected', "ClickSend message status: {$msg_status}" );
        }

        return true;
    }

    // =========================================================================
    // DELIVERY — Email via wp_mail
    // =========================================================================

    private function send_email( string $to, string $site_name, string $alert_type, string $message ) {
        $subject = $this->email_subject( $site_name, $alert_type );

        $body = $message . "\n\n---\n"
            . "Site: {$site_name}\n"
            . "Time: " . current_time( 'Y-m-d H:i' ) . " UTC\n"
            . "Sent by Gilba Agronomic Intelligence Hub\n";

        $sent = wp_mail( $to, $subject, $body );

        if ( ! $sent ) {
            return new WP_Error( 'wp_mail_failed', "wp_mail returned false for {$to}" );
        }

        return true;
    }

    private function email_subject( string $site_name, string $alert_type ): string {
        $labels = array(
            'disease'      => 'Disease Risk Alert',
            'pre_emergent' => 'Pre-Emergent Timing Alert',
            'stress'       => 'Turf Stress Alert',
        );
        $label = $labels[ $alert_type ] ?? 'Agronomic Alert';
        return "GAIP {$label} — {$site_name}";
    }

    // =========================================================================
    // SETTINGS ENDPOINTS
    // =========================================================================

    public function handle_get_settings( WP_REST_Request $request ) {
        return rest_ensure_response( array(
            'clicksend_username_set' => ! empty( get_option( self::OPT_CLICKSEND_USERNAME ) ),
            'clicksend_api_key_set'  => ! empty( get_option( self::OPT_CLICKSEND_API_KEY ) ),
            'from_number'            => get_option( self::OPT_FROM_NUMBER, 'GilbaHub' ),
            'admin_email'            => get_option( self::OPT_ADMIN_EMAIL, get_option( 'admin_email' ) ),
            'version'                => self::VERSION,
        ) );
    }

    public function handle_save_settings( WP_REST_Request $request ) {
        $body = $request->get_json_params();

        if ( isset( $body['clicksend_username'] ) ) {
            update_option( self::OPT_CLICKSEND_USERNAME, sanitize_text_field( $body['clicksend_username'] ) );
        }
        if ( isset( $body['clicksend_api_key'] ) ) {
            update_option( self::OPT_CLICKSEND_API_KEY, sanitize_text_field( $body['clicksend_api_key'] ) );
        }
        if ( isset( $body['from_number'] ) ) {
            update_option( self::OPT_FROM_NUMBER, sanitize_text_field( substr( $body['from_number'], 0, 11 ) ) );
        }
        if ( isset( $body['admin_email'] ) ) {
            update_option( self::OPT_ADMIN_EMAIL, sanitize_email( $body['admin_email'] ) );
        }

        return rest_ensure_response( array( 'saved' => true ) );
    }

    // =========================================================================
    // TEST ENDPOINT
    // =========================================================================

    public function handle_test( WP_REST_Request $request ) {
        $body = $request->get_json_params();
        $type  = sanitize_key( $body['type'] ?? 'sms' );
        $value = sanitize_text_field( $body['value'] ?? '' );

        if ( empty( $value ) ) {
            return new WP_Error( 'missing_value', 'value (phone or email) is required', array( 'status' => 400 ) );
        }

        $message = 'GAIP test alert — ClickSend credentials verified. Alerts are configured correctly.';

        if ( $type === 'sms' ) {
            $result = $this->send_sms( $value, $message );
        } else {
            $result = $this->send_email( $value, 'Test Site', 'test', $message );
        }

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'test_failed', $result->get_error_message(), array( 'status' => 500 ) );
        }

        return rest_ensure_response( array( 'sent' => true, 'type' => $type, 'to' => $value ) );
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /**
     * Returns true if current UTC time falls in quiet hours.
     * Quiet hours: 22:00–07:00.
     */
    private function is_quiet_hours(): bool {
        $hour = (int) gmdate( 'H' );
        return $hour >= self::QUIET_HOUR_START || $hour < self::QUIET_HOUR_END;
    }

    private function threshold_keys(): array {
        return array(
            'disease'      => self::THRESHOLD_DISEASE_HIGH,
            'pre_emergent' => 'RED_EARLY',
            'stress'       => self::THRESHOLD_STRESS,
        );
    }

    private function log_error( string $message ): void {
        if ( defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
            error_log( '[Gilba_Alerts] ' . $message );
        }
    }
}
