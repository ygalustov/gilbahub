<?php
/**
 * =============================================================================
 * GILBA PREDICTION LOGGER - PHP Backend v1.0.0
 * =============================================================================
 * 
 * Phase 1 of the Outcome Logging & Empirical Calibration system.
 * 
 * This file provides:
 * - Database table creation (wp_gilba_predictions, wp_gilba_outcomes, wp_gilba_calibration_offsets)
 * - REST API endpoints for prediction writes
 * - Site identifier resolution
 * 
 * USAGE:
 * Include this file in gilba-agronomic-intelligence-hub.php:
 *   require_once plugin_dir_path(__FILE__) . 'includes/class-gilba-prediction-logger.php';
 * 
 * Then call activation hook:
 *   register_activation_hook(__FILE__, array('Gilba_Prediction_Logger', 'activate'));
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

if (!defined('ABSPATH')) {
    exit;
}

class Gilba_Prediction_Logger {

    /**
     * Database table names (without prefix)
     */
    const TABLE_PREDICTIONS = 'gilba_predictions';
    const TABLE_OUTCOMES = 'gilba_outcomes';
    const TABLE_CALIBRATION = 'gilba_calibration_offsets';

    /**
     * REST API namespace — canonical value defined as GILBA_REST_NAMESPACE in main plugin file
     */
    const REST_NAMESPACE = 'gilba/v1';

    /**
     * Singleton instance
     */
    private static $instance = null;

    /**
     * Get singleton instance
     */
    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor - register hooks
     */
    private function __construct() {
        add_action('rest_api_init', array($this, 'register_rest_routes'));
    }

    // =========================================================================
    // DATABASE SETUP
    // =========================================================================

    /**
     * Create database tables on plugin activation
     */
    public static function activate() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();

        // Predictions table
        $table_predictions = $wpdb->prefix . self::TABLE_PREDICTIONS;
        $sql_predictions = "CREATE TABLE $table_predictions (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            site_id VARCHAR(100) NOT NULL,
            zone_id INT(11) DEFAULT NULL,
            module VARCHAR(40) NOT NULL,
            sub_key VARCHAR(80) NOT NULL,
            cascade_run_id VARCHAR(36) NOT NULL,
            predicted_at DATETIME NOT NULL,
            outcome_window_start DATETIME NOT NULL,
            outcome_window_end DATETIME NOT NULL,
            prediction_type ENUM('numeric', 'probability', 'category', 'timing') NOT NULL,
            predicted_value DECIMAL(12,4) DEFAULT NULL,
            predicted_label VARCHAR(120) DEFAULT NULL,
            predicted_category VARCHAR(40) DEFAULT NULL,
            confidence DECIMAL(4,3) DEFAULT NULL,
            input_snapshot LONGTEXT DEFAULT NULL,
            status ENUM('pending', 'captured', 'expired', 'superseded') NOT NULL DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_site_module_status (site_id, module, status),
            KEY idx_cascade_run (cascade_run_id),
            KEY idx_outcome_window (outcome_window_start, outcome_window_end, status),
            KEY idx_predicted_at (predicted_at)
        ) $charset_collate;";

        // Outcomes table
        $table_outcomes = $wpdb->prefix . self::TABLE_OUTCOMES;
        $sql_outcomes = "CREATE TABLE $table_outcomes (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            prediction_id BIGINT(20) UNSIGNED NOT NULL,
            captured_at DATETIME NOT NULL,
            capture_method ENUM('manual', 'sensor', 'api') NOT NULL DEFAULT 'manual',
            qualitative ENUM('better_than_expected', 'as_expected', 'worse_than_expected') DEFAULT NULL,
            observed_value DECIMAL(12,4) DEFAULT NULL,
            observed_category VARCHAR(40) DEFAULT NULL,
            action_taken ENUM('followed', 'modified', 'ignored', 'not_applicable') DEFAULT NULL,
            action_notes VARCHAR(500) DEFAULT NULL,
            environmental_notes LONGTEXT DEFAULT NULL,
            captured_by BIGINT(20) UNSIGNED DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_prediction_id (prediction_id),
            KEY idx_captured_at (captured_at),
            CONSTRAINT fk_outcome_prediction FOREIGN KEY (prediction_id) REFERENCES $table_predictions(id) ON DELETE CASCADE
        ) $charset_collate;";

        // Calibration offsets table
        $table_calibration = $wpdb->prefix . self::TABLE_CALIBRATION;
        $sql_calibration = "CREATE TABLE $table_calibration (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            site_id VARCHAR(100) NOT NULL,
            module VARCHAR(40) NOT NULL,
            sub_key VARCHAR(80) NOT NULL DEFAULT '__default__',
            offset_type ENUM('additive', 'multiplicative', 'categorical_shift') NOT NULL,
            offset_value DECIMAL(8,4) NOT NULL DEFAULT 0,
            sample_count INT(11) NOT NULL DEFAULT 0,
            confidence DECIMAL(4,3) NOT NULL DEFAULT 0,
            computed_at DATETIME NOT NULL,
            valid_from DATETIME NOT NULL,
            valid_until DATETIME DEFAULT NULL,
            computation_meta LONGTEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_site_module_subkey_valid (site_id, module, sub_key, valid_until),
            KEY idx_computed_at (computed_at)
        ) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        
        dbDelta($sql_predictions);
        dbDelta($sql_outcomes);
        dbDelta($sql_calibration);

        // Store schema version for future migrations
        update_option('gilba_prediction_schema_version', '1.0.0');
    }

    // =========================================================================
    // REST API ENDPOINTS
    // =========================================================================

    /**
     * Register REST API routes
     */
    public function register_rest_routes() {
        // POST /gilba/v1/predictions - Write prediction records
        register_rest_route(self::REST_NAMESPACE, '/predictions', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_write_predictions'),
            'permission_callback' => array($this, 'check_write_permission'),
        ));

        // GET /gilba/v1/predictions/pending/(?P<site_id>.+) - List pending predictions
        register_rest_route(self::REST_NAMESPACE, '/predictions/pending/(?P<site_id>.+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'handle_get_pending'),
            'permission_callback' => array($this, 'check_read_permission'),
        ));

        // GET /gilba/v1/calibration/(?P<site_id>.+) - Get active calibration offsets
        register_rest_route(self::REST_NAMESPACE, '/calibration/(?P<site_id>.+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'handle_get_calibration'),
            'permission_callback' => array($this, 'check_read_permission'),
        ));

        // POST /gilba/v1/outcomes - Write outcome record against a prediction
        register_rest_route(self::REST_NAMESPACE, '/outcomes', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_write_outcome'),
            'permission_callback' => array($this, 'check_write_permission'),
        ));

        // POST /gilba/v1/outcomes/batch - Write multiple outcome records at once
        register_rest_route(self::REST_NAMESPACE, '/outcomes/batch', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_write_outcome_batch'),
            'permission_callback' => array($this, 'check_write_permission'),
        ));

        // GET /gilba/v1/outcomes/history/(?P<site_id>.+) - Get captured outcomes history
        register_rest_route(self::REST_NAMESPACE, '/outcomes/history/(?P<site_id>.+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'handle_get_outcome_history'),
            'permission_callback' => array($this, 'check_read_permission'),
        ));
    }

    /**
     * Permission check for write operations
     */
    public function check_write_permission($request) {
        return is_user_logged_in();
    }

    /**
     * Permission check for read operations
     */
    public function check_read_permission($request) {
        return is_user_logged_in();
    }

    /**
     * Handle POST /predictions - Write prediction records
     */
    public function handle_write_predictions($request) {
        global $wpdb;

        $body = $request->get_json_params();
        $predictions = isset($body['predictions']) ? $body['predictions'] : array();

        if (empty($predictions)) {
            return new WP_REST_Response(array(
                'success' => true,
                'written' => 0,
                'message' => 'No predictions to write'
            ), 200);
        }

        $table = $wpdb->prefix . self::TABLE_PREDICTIONS;
        $written = 0;
        $errors = array();

        // Wrap in transaction to reduce disk I/O overhead (single fsync at COMMIT)
        $wpdb->query('START TRANSACTION');

        foreach ($predictions as $prediction) {
            $result = $wpdb->insert(
                $table,
                array(
                    'site_id' => sanitize_text_field($prediction['site_id']),
                    'zone_id' => isset($prediction['zone_id']) ? intval($prediction['zone_id']) : null,
                    'module' => sanitize_text_field($prediction['module']),
                    'sub_key' => sanitize_text_field($prediction['sub_key']),
                    'cascade_run_id' => sanitize_text_field($prediction['cascade_run_id']),
                    'predicted_at' => sanitize_text_field($prediction['predicted_at']),
                    'outcome_window_start' => sanitize_text_field($prediction['outcome_window_start']),
                    'outcome_window_end' => sanitize_text_field($prediction['outcome_window_end']),
                    'prediction_type' => sanitize_text_field($prediction['prediction_type']),
                    'predicted_value' => isset($prediction['predicted_value']) ? floatval($prediction['predicted_value']) : null,
                    'predicted_label' => isset($prediction['predicted_label']) ? sanitize_text_field($prediction['predicted_label']) : null,
                    'predicted_category' => isset($prediction['predicted_category']) ? sanitize_text_field($prediction['predicted_category']) : null,
                    'confidence' => isset($prediction['confidence']) ? floatval($prediction['confidence']) : null,
                    'input_snapshot' => isset($prediction['input_snapshot']) ? wp_json_encode($prediction['input_snapshot']) : null,
                    'status' => 'pending'
                ),
                array(
                    '%s', // site_id
                    '%d', // zone_id
                    '%s', // module
                    '%s', // sub_key
                    '%s', // cascade_run_id
                    '%s', // predicted_at
                    '%s', // outcome_window_start
                    '%s', // outcome_window_end
                    '%s', // prediction_type
                    '%f', // predicted_value
                    '%s', // predicted_label
                    '%s', // predicted_category
                    '%f', // confidence
                    '%s', // input_snapshot
                    '%s'  // status
                )
            );

            if ($result === false) {
                error_log( '[Gilba Predictions] Insert failed for ' . $prediction['module'] . '/' . $prediction['sub_key'] . ': ' . $wpdb->last_error );
                $errors[] = array(
                    'module' => $prediction['module'],
                    'sub_key' => $prediction['sub_key'],
                    'error' => 'Database write failed'
                );
            } else {
                $written++;
            }
        }

        $wpdb->query('COMMIT');

        $response = array(
            'success' => count($errors) === 0,
            'written' => $written,
            'total' => count($predictions)
        );

        if (!empty($errors)) {
            $response['errors'] = $errors;
        }

        return new WP_REST_Response($response, count($errors) === 0 ? 200 : 207);
    }

    /**
     * Handle GET /predictions/pending/{site_id} - List pending predictions
     */
    public function handle_get_pending($request) {
        global $wpdb;

        $site_id = sanitize_text_field($request->get_param('site_id'));
        $table = $wpdb->prefix . self::TABLE_PREDICTIONS;

        $now = current_time('mysql');

        // Get predictions where we're within the outcome window
        $predictions = $wpdb->get_results($wpdb->prepare(
            "SELECT id, module, sub_key, cascade_run_id, predicted_at, predicted_label,
                    predicted_value, predicted_category, prediction_type, confidence,
                    outcome_window_start, outcome_window_end
             FROM $table 
             WHERE site_id = %s 
               AND status = 'pending'
               AND outcome_window_start <= %s
               AND outcome_window_end >= %s
             ORDER BY predicted_at DESC, module ASC, outcome_window_end ASC",
            $site_id,
            $now,
            $now
        ), ARRAY_A);

        return new WP_REST_Response(array(
            'success' => true,
            'site_id' => $site_id,
            'pending' => $predictions,
            'count' => count($predictions)
        ), 200);
    }

    /**
     * Handle GET /calibration/{site_id} - Get active calibration offsets
     */
    public function handle_get_calibration($request) {
        global $wpdb;

        $site_id = sanitize_text_field($request->get_param('site_id'));
        $table = $wpdb->prefix . self::TABLE_CALIBRATION;

        $now = current_time('mysql');

        // Get current active offsets (valid_until is NULL or in future)
        $offsets = $wpdb->get_results($wpdb->prepare(
            "SELECT module, sub_key, offset_type, offset_value, confidence, sample_count, computed_at
             FROM $table 
             WHERE site_id = %s 
               AND valid_from <= %s
               AND (valid_until IS NULL OR valid_until > %s)
             ORDER BY module, sub_key",
            $site_id,
            $now,
            $now
        ), ARRAY_A);

        // Structure as nested object for easy consumption
        $structured = array();
        foreach ($offsets as $offset) {
            $module = $offset['module'];
            $sub_key = $offset['sub_key'];
            
            if (!isset($structured[$module])) {
                $structured[$module] = array();
            }
            
            $structured[$module][$sub_key] = array(
                'offset_type' => $offset['offset_type'],
                'offset_value' => floatval($offset['offset_value']),
                'confidence' => floatval($offset['confidence']),
                'sample_count' => intval($offset['sample_count']),
                'computed_at' => $offset['computed_at']
            );
        }

        return new WP_REST_Response(array(
            'success' => true,
            'site_id' => $site_id,
            'offsets' => $structured,
            'count' => count($offsets)
        ), 200);
    }

    /**
     * Handle POST /outcomes - Write an outcome record
     * 
     * Accepts: prediction_id, qualitative, observed_value, observed_category,
     *          action_taken, action_notes, environmental_notes
     * 
     * Side effect: Updates prediction status from 'pending' to 'captured'
     */
    public function handle_write_outcome($request) {
        global $wpdb;

        $body = $request->get_json_params();
        
        $prediction_id = isset($body['prediction_id']) ? intval($body['prediction_id']) : 0;
        if ($prediction_id <= 0) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => 'prediction_id is required'
            ), 400);
        }

        // Verify prediction exists and is pending
        $pred_table = $wpdb->prefix . self::TABLE_PREDICTIONS;
        $prediction = $wpdb->get_row($wpdb->prepare(
            "SELECT id, status FROM $pred_table WHERE id = %d",
            $prediction_id
        ));

        if (!$prediction) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => 'Prediction not found'
            ), 404);
        }

        if ($prediction->status !== 'pending') {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => 'Prediction already ' . $prediction->status
            ), 409);
        }

        // Write outcome
        $outcome_table = $wpdb->prefix . self::TABLE_OUTCOMES;
        $result = $wpdb->insert(
            $outcome_table,
            array(
                'prediction_id'       => $prediction_id,
                'captured_at'         => current_time('mysql'),
                'capture_method'      => 'manual',
                'qualitative'         => isset($body['qualitative']) ? sanitize_text_field($body['qualitative']) : null,
                'observed_value'      => isset($body['observed_value']) ? floatval($body['observed_value']) : null,
                'observed_category'   => isset($body['observed_category']) ? sanitize_text_field($body['observed_category']) : null,
                'action_taken'        => isset($body['action_taken']) ? sanitize_text_field($body['action_taken']) : null,
                'action_notes'        => isset($body['action_notes']) ? sanitize_text_field(substr($body['action_notes'], 0, 500)) : null,
                'environmental_notes' => isset($body['environmental_notes']) ? wp_json_encode($body['environmental_notes']) : null,
                'captured_by'         => get_current_user_id() ?: null,
            ),
            array('%d', '%s', '%s', '%s', '%f', '%s', '%s', '%s', '%s', '%d')
        );

        if ($result === false) {
            error_log( '[Gilba Outcomes] Insert failed for prediction ' . $prediction_id . ': ' . $wpdb->last_error );
            return new WP_REST_Response(array(
                'success' => false,
                'error' => 'Database write failed'
            ), 500);
        }

        $outcome_id = $wpdb->insert_id;

        // Flip prediction status to 'captured'
        $wpdb->update(
            $pred_table,
            array('status' => 'captured'),
            array('id' => $prediction_id),
            array('%s'),
            array('%d')
        );

        return new WP_REST_Response(array(
            'success' => true,
            'outcome_id' => $outcome_id,
            'prediction_id' => $prediction_id,
            'status' => 'captured'
        ), 201);
    }

    /**
     * Handle POST /outcomes/batch - Write multiple outcome records
     * 
     * Accepts: { outcomes: [ { prediction_id, qualitative, action_taken, action_notes }, ... ] }
     * All outcomes in the batch share the same qualitative + action unless overridden per-item.
     * 
     * Also accepts shorthand: { prediction_ids: [1,2,3], qualitative: '...', action_taken: '...' }
     * which applies the same outcome to all listed predictions.
     */
    public function handle_write_outcome_batch($request) {
        global $wpdb;

        $body = $request->get_json_params();
        $pred_table    = $wpdb->prefix . self::TABLE_PREDICTIONS;
        $outcome_table = $wpdb->prefix . self::TABLE_OUTCOMES;
        $now           = current_time('mysql');
        $user_id       = get_current_user_id() ?: null;

        // Build the outcomes list from either format
        $outcomes = array();

        if (!empty($body['outcomes']) && is_array($body['outcomes'])) {
            // Explicit per-prediction outcomes
            $outcomes = $body['outcomes'];
        } elseif (!empty($body['prediction_ids']) && is_array($body['prediction_ids'])) {
            // Shorthand: same outcome for all prediction IDs
            foreach ($body['prediction_ids'] as $pid) {
                $outcomes[] = array(
                    'prediction_id'       => intval($pid),
                    'qualitative'         => isset($body['qualitative']) ? $body['qualitative'] : null,
                    'action_taken'        => isset($body['action_taken']) ? $body['action_taken'] : null,
                    'action_notes'        => isset($body['action_notes']) ? $body['action_notes'] : null,
                    'environmental_notes' => isset($body['environmental_notes']) ? $body['environmental_notes'] : null,
                );
            }
        }

        if (empty($outcomes)) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => 'No outcomes provided'
            ), 400);
        }

        $written = 0;
        $skipped = 0;
        $errors  = array();

        // Step 1: Collect valid prediction IDs, skip invalid ones early
        $valid_outcomes = array();
        $prediction_ids = array();
        foreach ($outcomes as $item) {
            $prediction_id = isset($item['prediction_id']) ? intval($item['prediction_id']) : 0;
            if ($prediction_id <= 0) {
                $skipped++;
                continue;
            }
            $valid_outcomes[] = $item;
            $prediction_ids[] = $prediction_id;
        }

        if (!empty($valid_outcomes)) {
            // Step 2: Batch fetch all prediction statuses (1 query instead of N)
            $id_placeholders = implode(',', array_fill(0, count($prediction_ids), '%d'));
            $statuses_raw = $wpdb->get_results($wpdb->prepare(
                "SELECT id, status FROM $pred_table WHERE id IN ($id_placeholders)",
                $prediction_ids
            ), OBJECT_K);

            // Step 3: Insert outcomes within a transaction
            $captured_ids = array();
            $wpdb->query('START TRANSACTION');

            foreach ($valid_outcomes as $item) {
                $prediction_id = intval($item['prediction_id']);

                // Check status from batch result
                if (!isset($statuses_raw[$prediction_id]) || $statuses_raw[$prediction_id]->status !== 'pending') {
                    $skipped++;
                    continue;
                }

                $result = $wpdb->insert(
                    $outcome_table,
                    array(
                        'prediction_id'       => $prediction_id,
                        'captured_at'         => $now,
                        'capture_method'      => 'manual',
                        'qualitative'         => isset($item['qualitative']) ? sanitize_text_field($item['qualitative']) : null,
                        'observed_value'      => isset($item['observed_value']) ? floatval($item['observed_value']) : null,
                        'observed_category'   => isset($item['observed_category']) ? sanitize_text_field($item['observed_category']) : null,
                        'action_taken'        => isset($item['action_taken']) ? sanitize_text_field($item['action_taken']) : null,
                        'action_notes'        => isset($item['action_notes']) ? sanitize_text_field(substr($item['action_notes'], 0, 500)) : null,
                        'environmental_notes' => isset($item['environmental_notes']) ? wp_json_encode($item['environmental_notes']) : null,
                        'captured_by'         => $user_id,
                    ),
                    array('%d', '%s', '%s', '%s', '%f', '%s', '%s', '%s', '%s', '%d')
                );

                if ($result === false) {
                    error_log( '[Gilba Outcomes] Batch insert failed for prediction ' . $prediction_id . ': ' . $wpdb->last_error );
                    $errors[] = array('prediction_id' => $prediction_id, 'error' => 'Database write failed');
                } else {
                    $captured_ids[] = $prediction_id;
                    $written++;
                }
            }

            // Step 4: Batch update all captured predictions (1 query instead of N)
            if (!empty($captured_ids)) {
                $update_placeholders = implode(',', array_fill(0, count($captured_ids), '%d'));
                $wpdb->query($wpdb->prepare(
                    "UPDATE $pred_table SET status = 'captured' WHERE id IN ($update_placeholders)",
                    $captured_ids
                ));
            }

            $wpdb->query('COMMIT');
        }

        return new WP_REST_Response(array(
            'success' => count($errors) === 0,
            'written' => $written,
            'skipped' => $skipped,
            'total'   => count($outcomes),
            'errors'  => !empty($errors) ? $errors : null
        ), count($errors) === 0 ? 201 : 207);
    }

    /**
     * Handle GET /outcomes/history/{site_id} - Recent outcome history
     * 
     * Query params: limit (default 50), module (optional filter)
     */
    public function handle_get_outcome_history($request) {
        global $wpdb;

        $site_id = sanitize_text_field($request->get_param('site_id'));
        $limit   = min(intval($request->get_param('limit') ?: 50), 200);
        $module  = $request->get_param('module') ? sanitize_text_field($request->get_param('module')) : null;

        $pred_table    = $wpdb->prefix . self::TABLE_PREDICTIONS;
        $outcome_table = $wpdb->prefix . self::TABLE_OUTCOMES;

        $where_module = $module ? $wpdb->prepare(" AND p.module = %s", $module) : '';

        $results = $wpdb->get_results($wpdb->prepare(
            "SELECT p.id as prediction_id, p.module, p.sub_key, p.predicted_at,
                    p.predicted_label, p.predicted_value, p.predicted_category,
                    p.prediction_type, p.confidence,
                    o.id as outcome_id, o.captured_at, o.qualitative,
                    o.observed_value, o.observed_category, o.action_taken, o.action_notes
             FROM $outcome_table o
             INNER JOIN $pred_table p ON o.prediction_id = p.id
             WHERE p.site_id = %s $where_module
             ORDER BY o.captured_at DESC
             LIMIT %d",
            $site_id,
            $limit
        ), ARRAY_A);

        return new WP_REST_Response(array(
            'success' => true,
            'site_id' => $site_id,
            'outcomes' => $results,
            'count'   => count($results)
        ), 200);
    }

    // =========================================================================
    // CRON JOBS (for Phase 3)
    // =========================================================================

    /**
     * Register cron schedules
     */
    public static function register_cron_schedules($schedules) {
        $schedules['gilba_hourly'] = array(
            'interval' => HOUR_IN_SECONDS,
            'display' => __('Every Hour (Gilba)')
        );
        $schedules['gilba_daily'] = array(
            'interval' => DAY_IN_SECONDS,
            'display' => __('Once Daily (Gilba)')
        );
        return $schedules;
    }

    /**
     * Schedule cron jobs on activation
     */
    public static function schedule_cron_jobs() {
        if (!wp_next_scheduled('gilba_expire_predictions')) {
            wp_schedule_event(time(), 'gilba_hourly', 'gilba_expire_predictions');
        }
        // Calibration computation scheduled for Phase 3
        // if (!wp_next_scheduled('gilba_compute_calibration')) {
        //     wp_schedule_event(strtotime('03:00:00'), 'gilba_daily', 'gilba_compute_calibration');
        // }
    }

    /**
     * Clear cron jobs on deactivation
     */
    public static function clear_cron_jobs() {
        wp_clear_scheduled_hook('gilba_expire_predictions');
        wp_clear_scheduled_hook('gilba_compute_calibration');
    }

    /**
     * Expire predictions past their outcome window
     */
    public static function expire_predictions() {
        global $wpdb;
        
        $table = $wpdb->prefix . self::TABLE_PREDICTIONS;
        $now = current_time('mysql');

        $updated = $wpdb->query($wpdb->prepare(
            "UPDATE $table 
             SET status = 'expired' 
             WHERE status = 'pending' 
               AND outcome_window_end < %s",
            $now
        ));

        if ($updated > 0) {
            error_log("[Gilba] Expired $updated predictions past their outcome window");
        }
    }

}

// =========================================================================
// INITIALIZATION
// =========================================================================

// Initialize singleton on plugins_loaded
add_action('plugins_loaded', array('Gilba_Prediction_Logger', 'get_instance'));

// Register cron filter
add_filter('cron_schedules', array('Gilba_Prediction_Logger', 'register_cron_schedules'));

// Register cron action
add_action('gilba_expire_predictions', array('Gilba_Prediction_Logger', 'expire_predictions'));
