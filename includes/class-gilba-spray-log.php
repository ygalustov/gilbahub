<?php
/**
 * =============================================================================
 * GILBA SPRAY LOG - PHP Backend v1.0.0
 * =============================================================================
 * 
 * Unified application logging for all product types (fungicide, PGR, nutrition,
 * wetting agent, pre-emergent, insecticide). Stores per-zone application history
 * and feeds data back into PGR, DMI, disease, and phytotoxicity engines.
 * 
 * USAGE:
 * Include in gilba-agronomic-intelligence-hub.php:
 *   require_once plugin_dir_path(__FILE__) . 'includes/class-gilba-spray-log.php';
 * 
 * Register activation hook:
 *   register_activation_hook(__FILE__, array('Gilba_Spray_Log', 'activate'));
 * 
 * ENDPOINTS:
 *   POST   /gilba/v1/spray-log           — Create entry (or batch)
 *   GET    /gilba/v1/spray-log            — List with filters
 *   PUT    /gilba/v1/spray-log/{log_id}   — Update entry
 *   DELETE /gilba/v1/spray-log/{log_id}   — Delete entry
 *   GET    /gilba/v1/spray-log/summary    — FRAC rotation + product frequency
 *   GET    /gilba/v1/spray-log/context    — Engine context (recent apps for cascade)
 * 
 * @author  Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

if (!defined('ABSPATH')) {
    exit;
}

class Gilba_Spray_Log {

    /**
     * Database table name (without prefix)
     */
    const TABLE_SPRAY_LOG = 'gilba_spray_log';

    /**
     * REST API namespace — canonical value defined as GILBA_REST_NAMESPACE in main plugin file
     */
    const REST_NAMESPACE = 'gilba/v1';

    /**
     * Valid product categories
     */
    const VALID_CATEGORIES = array(
        'fungicide', 'pgr', 'nutrition', 'wetting_agent', 
        'pre_emergent', 'insecticide', 'other'
    );

    /**
     * Valid rate units
     */
    const VALID_RATE_UNITS = array(
        'L/ha', 'kg/ha', 'mL/100m2', 'g/100m2'
    );

    /**
     * Valid source types
     */
    const VALID_SOURCES = array('manual', 'recommendation', 'bulk_import');

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
     * Constructor — register hooks
     */
    private function __construct() {
        add_action('rest_api_init', array($this, 'register_rest_routes'));
    }

    // =========================================================================
    // DATABASE SETUP
    // =========================================================================

    /**
     * Create database table on plugin activation
     */
    public static function activate() {
        global $wpdb;

        $charset_collate = $wpdb->get_charset_collate();
        $table = $wpdb->prefix . self::TABLE_SPRAY_LOG;

        $sql = "CREATE TABLE $table (
            log_id VARCHAR(36) NOT NULL,
            user_id BIGINT(20) UNSIGNED NOT NULL,
            logged_by BIGINT(20) UNSIGNED NOT NULL,
            site_id VARCHAR(100) NOT NULL,
            zone VARCHAR(64) NOT NULL DEFAULT 'greens',
            application_date DATE NOT NULL,
            product_category VARCHAR(20) NOT NULL DEFAULT 'other',
            product_key VARCHAR(128) DEFAULT NULL,
            product_name VARCHAR(255) NOT NULL,
            active_ingredient VARCHAR(255) DEFAULT NULL,
            frac_group VARCHAR(16) DEFAULT NULL,
            rate DECIMAL(8,3) DEFAULT NULL,
            rate_unit VARCHAR(20) DEFAULT NULL,
            rate_normalised DECIMAL(8,3) DEFAULT NULL,
            rate_normalised_unit VARCHAR(10) DEFAULT NULL,
            water_volume DECIMAL(8,2) DEFAULT NULL,
            target VARCHAR(128) DEFAULT NULL,
            source VARCHAR(20) NOT NULL DEFAULT 'manual',
            recommendation_id VARCHAR(36) DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (log_id),
            KEY idx_site_zone_date (site_id, zone, application_date),
            KEY idx_user_site (user_id, site_id),
            KEY idx_logged_by (logged_by),
            KEY idx_category_date (product_category, application_date),
            KEY idx_frac_site (frac_group, site_id, application_date),
            KEY idx_recommendation (recommendation_id)
        ) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);

        update_option('gilba_spray_log_schema_version', '1.0.0');
    }

    // =========================================================================
    // REST API ROUTES
    // =========================================================================

    /**
     * Register REST API routes
     */
    public function register_rest_routes() {

        // POST /gilba/v1/spray-log — Create entry (or batch with multi-zone)
        register_rest_route(self::REST_NAMESPACE, '/spray-log', array(
            'methods'             => 'POST',
            'callback'            => array($this, 'handle_create'),
            'permission_callback' => array($this, 'check_write_permission'),
        ));

        // GET /gilba/v1/spray-log — List with filters
        register_rest_route(self::REST_NAMESPACE, '/spray-log', array(
            'methods'             => 'GET',
            'callback'            => array($this, 'handle_list'),
            'permission_callback' => array($this, 'check_read_permission'),
        ));

        // PUT /gilba/v1/spray-log/(?P<log_id>[a-f0-9\-]+) — Update entry
        register_rest_route(self::REST_NAMESPACE, '/spray-log/(?P<log_id>[a-f0-9\-]+)', array(
            'methods'             => 'PUT',
            'callback'            => array($this, 'handle_update'),
            'permission_callback' => array($this, 'check_write_permission'),
        ));

        // DELETE /gilba/v1/spray-log/(?P<log_id>[a-f0-9\-]+) — Delete entry
        register_rest_route(self::REST_NAMESPACE, '/spray-log/(?P<log_id>[a-f0-9\-]+)', array(
            'methods'             => 'DELETE',
            'callback'            => array($this, 'handle_delete'),
            'permission_callback' => array($this, 'check_write_permission'),
        ));

        // GET /gilba/v1/spray-log/summary — FRAC rotation + product frequency
        register_rest_route(self::REST_NAMESPACE, '/spray-log/summary', array(
            'methods'             => 'GET',
            'callback'            => array($this, 'handle_summary'),
            'permission_callback' => array($this, 'check_read_permission'),
        ));

        // GET /gilba/v1/spray-log/context — Engine context for cascade stage 0.5
        register_rest_route(self::REST_NAMESPACE, '/spray-log/context', array(
            'methods'             => 'GET',
            'callback'            => array($this, 'handle_context'),
            'permission_callback' => array($this, 'check_read_permission'),
        ));
    }

    // =========================================================================
    // PERMISSIONS — matches prediction logger pattern
    // =========================================================================

    public function check_write_permission($request) {
        return is_user_logged_in();
    }

    public function check_read_permission($request) {
        return is_user_logged_in();
    }

    // =========================================================================
    // UUID GENERATION
    // =========================================================================

    /**
     * Generate UUID v4
     */
    private static function generate_uuid() {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40); // Version 4
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80); // Variant 1
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    // =========================================================================
    // RATE NORMALISATION
    // =========================================================================

    /**
     * Normalise rate to L/ha or kg/ha for engine calculations.
     * 
     * Conversion factors:
     *   mL/100m² → L/ha:  × 0.1
     *   g/100m²  → kg/ha: × 0.1
     *   L/ha     → L/ha:  × 1 (identity)
     *   kg/ha    → kg/ha: × 1 (identity)
     */
    private static function normalise_rate($rate, $unit) {
        if ($rate === null || $unit === null) {
            return array('rate' => null, 'unit' => null);
        }

        $rate = floatval($rate);

        switch ($unit) {
            case 'mL/100m2':
                return array('rate' => round($rate * 0.1, 3), 'unit' => 'L/ha');
            case 'g/100m2':
                return array('rate' => round($rate * 0.1, 3), 'unit' => 'kg/ha');
            case 'L/ha':
                return array('rate' => $rate, 'unit' => 'L/ha');
            case 'kg/ha':
                return array('rate' => $rate, 'unit' => 'kg/ha');
            default:
                return array('rate' => $rate, 'unit' => $unit);
        }
    }

    // =========================================================================
    // VALIDATION
    // =========================================================================

    /**
     * Validate and sanitise a single spray log entry
     */
    private function validate_entry($data) {
        $errors = array();

        // Required fields
        if (empty($data['site_id'])) {
            $errors[] = 'site_id is required';
        }
        if (empty($data['application_date'])) {
            $errors[] = 'application_date is required';
        }
        if (empty($data['product_name'])) {
            $errors[] = 'product_name is required';
        }

        // Validate category
        $category = isset($data['product_category']) ? $data['product_category'] : 'other';
        if (!in_array($category, self::VALID_CATEGORIES)) {
            $errors[] = 'Invalid product_category: ' . $category;
        }

        // Validate rate unit
        $rate_unit = isset($data['rate_unit']) ? $data['rate_unit'] : null;
        if ($rate_unit !== null && !in_array($rate_unit, self::VALID_RATE_UNITS)) {
            $errors[] = 'Invalid rate_unit: ' . $rate_unit;
        }

        // Validate source
        $source = isset($data['source']) ? $data['source'] : 'manual';
        if (!in_array($source, self::VALID_SOURCES)) {
            $errors[] = 'Invalid source: ' . $source;
        }

        // Validate date format
        if (!empty($data['application_date'])) {
            $date = DateTime::createFromFormat('Y-m-d', $data['application_date']);
            if (!$date || $date->format('Y-m-d') !== $data['application_date']) {
                $errors[] = 'Invalid application_date format (expected Y-m-d)';
            }
        }

        return $errors;
    }

    /**
     * Sanitise entry data into a database-ready row
     */
    private function sanitise_entry($data) {
        $rate = isset($data['rate']) ? floatval($data['rate']) : null;
        $rate_unit = isset($data['rate_unit']) ? sanitize_text_field($data['rate_unit']) : null;
        $normalised = self::normalise_rate($rate, $rate_unit);

        return array(
            'site_id'              => sanitize_text_field($data['site_id']),
            'zone'                 => isset($data['zone']) ? sanitize_text_field($data['zone']) : 'greens',
            'application_date'     => sanitize_text_field($data['application_date']),
            'product_category'     => isset($data['product_category']) ? sanitize_text_field($data['product_category']) : 'other',
            'product_key'          => isset($data['product_key']) ? sanitize_text_field($data['product_key']) : null,
            'product_name'         => sanitize_text_field($data['product_name']),
            'active_ingredient'    => isset($data['active_ingredient']) ? sanitize_text_field($data['active_ingredient']) : null,
            'frac_group'           => isset($data['frac_group']) ? sanitize_text_field($data['frac_group']) : null,
            'rate'                 => $rate,
            'rate_unit'            => $rate_unit,
            'rate_normalised'      => $normalised['rate'],
            'rate_normalised_unit' => $normalised['unit'],
            'water_volume'         => isset($data['water_volume']) ? floatval($data['water_volume']) : null,
            'target'               => isset($data['target']) ? sanitize_text_field($data['target']) : null,
            'source'               => isset($data['source']) ? sanitize_text_field($data['source']) : 'manual',
            'recommendation_id'    => isset($data['recommendation_id']) ? sanitize_text_field($data['recommendation_id']) : null,
            'notes'                => isset($data['notes']) ? sanitize_textarea_field($data['notes']) : null,
        );
    }

    // =========================================================================
    // HANDLER: CREATE (POST /spray-log)
    // =========================================================================

    /**
     * Create one or more spray log entries.
     * 
     * Supports multi-zone: if `zones` array is provided, creates one entry per zone.
     * Otherwise creates a single entry using `zone` field.
     */
    public function handle_create($request) {
        global $wpdb;

        $body = $request->get_json_params();
        $table = $wpdb->prefix . self::TABLE_SPRAY_LOG;
        $current_user_id = get_current_user_id();

        // Determine user_id and logged_by
        $user_id = isset($body['user_id']) ? intval($body['user_id']) : $current_user_id;
        $logged_by = $current_user_id;

        // Multi-zone support: if `zones` array provided, duplicate entry for each zone
        $zones = isset($body['zones']) && is_array($body['zones']) ? $body['zones'] : null;
        
        if ($zones) {
            // Validate base entry once
            $validation_errors = $this->validate_entry($body);
            if (!empty($validation_errors)) {
                return new WP_REST_Response(array(
                    'success' => false,
                    'errors'  => $validation_errors
                ), 400);
            }

            $created = array();
            $errors = array();

            $insert_format = array(
                '%s', '%d', '%d', // log_id, user_id, logged_by
                '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', // site_id..frac_group
                '%f', '%s', '%f', '%s', '%f', // rate, rate_unit, rate_normalised, rate_normalised_unit, water_volume
                '%s', '%s', '%s', '%s', // target, source, recommendation_id, notes
            );

            // Wrap multi-zone inserts in a transaction to reduce disk I/O overhead
            $wpdb->query('START TRANSACTION');

            foreach ($zones as $zone) {
                $body['zone'] = $zone;
                $entry = $this->sanitise_entry($body);
                $log_id = self::generate_uuid();

                $result = $wpdb->insert($table, array_merge(
                    array(
                        'log_id'    => $log_id,
                        'user_id'   => $user_id,
                        'logged_by' => $logged_by,
                    ),
                    $entry
                ), $insert_format);

                if ($result === false) {
                    error_log( '[Gilba Spray Log] Insert failed for zone ' . $zone . ': ' . $wpdb->last_error );
                    $errors[] = array('zone' => $zone, 'error' => 'Database write failed');
                } else {
                    $created[] = array('log_id' => $log_id, 'zone' => $zone);
                }
            }

            $wpdb->query('COMMIT');

            return new WP_REST_Response(array(
                'success' => empty($errors),
                'created' => $created,
                'count'   => count($created),
                'errors'  => $errors
            ), empty($errors) ? 201 : 207);

        } else {
            // Single entry
            $validation_errors = $this->validate_entry($body);
            if (!empty($validation_errors)) {
                return new WP_REST_Response(array(
                    'success' => false,
                    'errors'  => $validation_errors
                ), 400);
            }

            $entry = $this->sanitise_entry($body);
            $log_id = self::generate_uuid();

            $insert_format = array(
                '%s', '%d', '%d', // log_id, user_id, logged_by
                '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', // site_id..frac_group
                '%f', '%s', '%f', '%s', '%f', // rate, rate_unit, rate_normalised, rate_normalised_unit, water_volume
                '%s', '%s', '%s', '%s', // target, source, recommendation_id, notes
            );

            $result = $wpdb->insert($table, array_merge(
                array(
                    'log_id'    => $log_id,
                    'user_id'   => $user_id,
                    'logged_by' => $logged_by,
                ),
                $entry
            ), $insert_format);

            if ($result === false) {
                error_log( '[Gilba Spray Log] Insert failed: ' . $wpdb->last_error );
                return new WP_REST_Response(array(
                    'success' => false,
                    'error'   => 'Database write failed'
                ), 500);
            }

            return new WP_REST_Response(array(
                'success' => true,
                'log_id'  => $log_id
            ), 201);
        }
    }

    // =========================================================================
    // HANDLER: LIST (GET /spray-log)
    // =========================================================================

    /**
     * List spray log entries with filters.
     * 
     * Query params:
     *   site_id    (required)
     *   zone       (optional, comma-separated for multiple)
     *   category   (optional, comma-separated)
     *   frac_group (optional)
     *   days       (optional, default 365 — entries from last N days)
     *   date_from  (optional, Y-m-d)
     *   date_to    (optional, Y-m-d)
     *   limit      (optional, default 100, max 500)
     *   offset     (optional, default 0)
     */
    public function handle_list($request) {
        global $wpdb;

        $site_id = sanitize_text_field($request->get_param('site_id'));
        $user_id = get_current_user_id();

        // Allow either site_id or user_id based filtering
        if (empty($site_id) && empty($user_id)) {
            return new WP_REST_Response(array(
                'success' => false,
                'error'   => 'site_id is required'
            ), 400);
        }

        $table = $wpdb->prefix . self::TABLE_SPRAY_LOG;

        // Build WHERE clause — always filter strictly by site_id when provided.
        // The old "OR site_id IS NULL" fallback caused entries without a site_id
        // to appear on every site's list. Entries without site_id are isolated to
        // the user-level fallback (no site_id param) only.
        if (!empty($site_id)) {
            $where = array('site_id = %s');
            $params = array($site_id);
        } else {
            $where = array('user_id = %d');
            $params = array($user_id);
        }

        // Zone filter (comma-separated)
        $zone = $request->get_param('zone');
        if (!empty($zone)) {
            $zones = array_map('sanitize_text_field', explode(',', $zone));
            $placeholders = implode(',', array_fill(0, count($zones), '%s'));
            $where[] = "zone IN ($placeholders)";
            $params = array_merge($params, $zones);
        }

        // Category filter (comma-separated)
        $category = $request->get_param('category');
        if (!empty($category)) {
            $categories = array_map('sanitize_text_field', explode(',', $category));
            $placeholders = implode(',', array_fill(0, count($categories), '%s'));
            $where[] = "product_category IN ($placeholders)";
            $params = array_merge($params, $categories);
        }

        // FRAC group filter
        $frac = $request->get_param('frac_group');
        if (!empty($frac)) {
            $where[] = 'frac_group = %s';
            $params[] = sanitize_text_field($frac);
        }

        // Date range
        $date_from = $request->get_param('date_from');
        $date_to = $request->get_param('date_to');
        
        if (!empty($date_from)) {
            $where[] = 'application_date >= %s';
            $params[] = sanitize_text_field($date_from);
        }
        if (!empty($date_to)) {
            $where[] = 'application_date <= %s';
            $params[] = sanitize_text_field($date_to);
        }

        // Default to last N days if no date range specified
        if (empty($date_from) && empty($date_to)) {
            $days = intval($request->get_param('days') ?: 365);
            $days = min(max($days, 1), 1095); // 1 day to 3 years
            $where[] = 'application_date >= DATE_SUB(CURDATE(), INTERVAL %d DAY)';
            $params[] = $days;
        }

        // Pagination
        $limit = min(intval($request->get_param('limit') ?: 100), 500);
        $offset = max(intval($request->get_param('offset') ?: 0), 0);

        $where_sql = implode(' AND ', $where);

        // Get total count
        $count_sql = "SELECT COUNT(*) FROM $table WHERE $where_sql";
        $total = $wpdb->get_var($wpdb->prepare($count_sql, $params));

        // Get entries
        $select_sql = "SELECT * FROM $table WHERE $where_sql ORDER BY application_date DESC, created_at DESC LIMIT %d OFFSET %d";
        $params[] = $limit;
        $params[] = $offset;

        $entries = $wpdb->get_results($wpdb->prepare($select_sql, $params), ARRAY_A);

        return new WP_REST_Response(array(
            'success' => true,
            'entries' => $entries,
            'total'   => intval($total),
            'limit'   => $limit,
            'offset'  => $offset
        ), 200);
    }

    // =========================================================================
    // HANDLER: UPDATE (PUT /spray-log/{log_id})
    // =========================================================================

    public function handle_update($request) {
        global $wpdb;

        $log_id = sanitize_text_field($request->get_param('log_id'));
        $table = $wpdb->prefix . self::TABLE_SPRAY_LOG;

        // Verify entry exists and belongs to user
        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT log_id, user_id, logged_by FROM $table WHERE log_id = %s",
            $log_id
        ), ARRAY_A);

        if (!$existing) {
            return new WP_REST_Response(array(
                'success' => false,
                'error'   => 'Entry not found'
            ), 404);
        }

        // Permission: must be the site owner or the person who logged it
        $current_user_id = get_current_user_id();
        if ($current_user_id != $existing['user_id'] && $current_user_id != $existing['logged_by']) {
            return new WP_REST_Response(array(
                'success' => false,
                'error'   => 'Permission denied'
            ), 403);
        }

        $body = $request->get_json_params();
        
        // Build update array from provided fields only
        $update = array();
        $updatable_fields = array(
            'zone', 'application_date', 'product_category', 'product_key',
            'product_name', 'active_ingredient', 'frac_group', 'rate',
            'rate_unit', 'water_volume', 'target', 'notes'
        );

        foreach ($updatable_fields as $field) {
            if (isset($body[$field])) {
                $update[$field] = sanitize_text_field($body[$field]);
            }
        }

        // Re-normalise rate if rate or rate_unit changed
        if (isset($update['rate']) || isset($update['rate_unit'])) {
            $rate = isset($update['rate']) ? floatval($update['rate']) : null;
            $rate_unit = isset($update['rate_unit']) ? $update['rate_unit'] : null;
            
            // If only one changed, fetch the other from existing record
            if ($rate === null || $rate_unit === null) {
                $existing_full = $wpdb->get_row($wpdb->prepare(
                    "SELECT rate, rate_unit FROM $table WHERE log_id = %s", $log_id
                ), ARRAY_A);
                if ($rate === null) $rate = floatval($existing_full['rate']);
                if ($rate_unit === null) $rate_unit = $existing_full['rate_unit'];
            }

            $normalised = self::normalise_rate($rate, $rate_unit);
            $update['rate_normalised'] = $normalised['rate'];
            $update['rate_normalised_unit'] = $normalised['unit'];
        }

        if (empty($update)) {
            return new WP_REST_Response(array(
                'success' => false,
                'error'   => 'No fields to update'
            ), 400);
        }

        // Build format array dynamically based on which fields are being updated
        $field_format_map = array(
            'zone' => '%s', 'application_date' => '%s', 'product_category' => '%s',
            'product_key' => '%s', 'product_name' => '%s', 'active_ingredient' => '%s',
            'frac_group' => '%s', 'rate' => '%f', 'rate_unit' => '%s',
            'water_volume' => '%f', 'target' => '%s', 'notes' => '%s',
            'rate_normalised' => '%f', 'rate_normalised_unit' => '%s',
        );
        $update_format = array();
        foreach (array_keys($update) as $key) {
            $update_format[] = isset($field_format_map[$key]) ? $field_format_map[$key] : '%s';
        }

        $result = $wpdb->update($table, $update, array('log_id' => $log_id), $update_format, array('%s'));

        if ($result === false) {
            error_log( '[Gilba Spray Log] Update failed for log_id ' . $log_id . ': ' . $wpdb->last_error );
            return new WP_REST_Response(array(
                'success' => false,
                'error'   => 'Database update failed'
            ), 500);
        }

        return new WP_REST_Response(array(
            'success'  => true,
            'log_id'   => $log_id,
            'updated'  => array_keys($update)
        ), 200);
    }

    // =========================================================================
    // HANDLER: DELETE (DELETE /spray-log/{log_id})
    // =========================================================================

    public function handle_delete($request) {
        global $wpdb;

        $log_id = sanitize_text_field($request->get_param('log_id'));
        $table = $wpdb->prefix . self::TABLE_SPRAY_LOG;

        // Verify entry exists and belongs to user
        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT log_id, user_id, logged_by FROM $table WHERE log_id = %s",
            $log_id
        ), ARRAY_A);

        if (!$existing) {
            return new WP_REST_Response(array(
                'success' => false,
                'error'   => 'Entry not found'
            ), 404);
        }

        $current_user_id = get_current_user_id();
        if ($current_user_id != $existing['user_id'] && $current_user_id != $existing['logged_by']) {
            return new WP_REST_Response(array(
                'success' => false,
                'error'   => 'Permission denied'
            ), 403);
        }

        $result = $wpdb->delete($table, array('log_id' => $log_id), array('%s'));

        return new WP_REST_Response(array(
            'success' => $result !== false,
            'log_id'  => $log_id
        ), $result !== false ? 200 : 500);
    }

    // =========================================================================
    // HANDLER: SUMMARY (GET /spray-log/summary)
    // =========================================================================

    /**
     * Aggregated view: FRAC rotation analysis and product frequency.
     * 
     * Query params:
     *   site_id  (required)
     *   zone     (optional)
     *   months   (optional, default 12)
     */
    public function handle_summary($request) {
        global $wpdb;

        $site_id = sanitize_text_field($request->get_param('site_id'));
        if (empty($site_id)) {
            return new WP_REST_Response(array(
                'success' => false,
                'error'   => 'site_id is required'
            ), 400);
        }

        $zone = sanitize_text_field($request->get_param('zone') ?: '');
        $months = min(intval($request->get_param('months') ?: 12), 36);
        $table = $wpdb->prefix . self::TABLE_SPRAY_LOG;

        $zone_clause = !empty($zone) ? $wpdb->prepare(' AND zone = %s', $zone) : '';

        // FRAC group usage (fungicides only)
        $frac_sql = $wpdb->prepare(
            "SELECT frac_group, COUNT(*) as count, 
                    MAX(application_date) as last_used,
                    GROUP_CONCAT(DISTINCT product_name ORDER BY application_date DESC) as products
             FROM $table 
             WHERE site_id = %s 
               AND product_category = 'fungicide'
               AND frac_group IS NOT NULL
               AND application_date >= DATE_SUB(CURDATE(), INTERVAL %d MONTH)
               $zone_clause
             GROUP BY frac_group
             ORDER BY count DESC",
            $site_id, $months
        );
        $frac_usage = $wpdb->get_results($frac_sql, ARRAY_A);

        // Consecutive same-FRAC applications (rotation analysis)
        $rotation_sql = $wpdb->prepare(
            "SELECT frac_group, application_date, product_name, zone
             FROM $table 
             WHERE site_id = %s 
               AND product_category = 'fungicide'
               AND frac_group IS NOT NULL
               AND application_date >= DATE_SUB(CURDATE(), INTERVAL %d MONTH)
               $zone_clause
             ORDER BY zone ASC, application_date DESC",
            $site_id, $months
        );
        $rotation_entries = $wpdb->get_results($rotation_sql, ARRAY_A);

        // Detect consecutive same-FRAC runs per zone
        $rotation_warnings = array();
        $by_zone = array();
        foreach ($rotation_entries as $entry) {
            $by_zone[$entry['zone']][] = $entry;
        }
        foreach ($by_zone as $z => $entries) {
            $streak = 1;
            for ($i = 1; $i < count($entries); $i++) {
                if ($entries[$i]['frac_group'] === $entries[$i-1]['frac_group']) {
                    $streak++;
                    if ($streak >= 3) {
                        $rotation_warnings[] = array(
                            'zone'       => $z,
                            'frac_group' => $entries[$i]['frac_group'],
                            'streak'     => $streak,
                            'products'   => array_column(array_slice($entries, $i - $streak + 1, $streak), 'product_name'),
                            'severity'   => $streak >= 4 ? 'high' : 'moderate'
                        );
                    }
                } else {
                    $streak = 1;
                }
            }
        }

        // Product frequency (all categories)
        $frequency_sql = $wpdb->prepare(
            "SELECT product_name, product_category, COUNT(*) as count,
                    MIN(application_date) as first_used,
                    MAX(application_date) as last_used
             FROM $table 
             WHERE site_id = %s
               AND application_date >= DATE_SUB(CURDATE(), INTERVAL %d MONTH)
               $zone_clause
             GROUP BY product_name, product_category
             ORDER BY count DESC",
            $site_id, $months
        );
        $product_frequency = $wpdb->get_results($frequency_sql, ARRAY_A);

        // Total applications by category
        $category_sql = $wpdb->prepare(
            "SELECT product_category, COUNT(*) as count
             FROM $table 
             WHERE site_id = %s
               AND application_date >= DATE_SUB(CURDATE(), INTERVAL %d MONTH)
               $zone_clause
             GROUP BY product_category
             ORDER BY count DESC",
            $site_id, $months
        );
        $by_category = $wpdb->get_results($category_sql, ARRAY_A);

        return new WP_REST_Response(array(
            'success'            => true,
            'site_id'            => $site_id,
            'zone'               => $zone ?: 'all',
            'months'             => $months,
            'frac_usage'         => $frac_usage,
            'rotation_warnings'  => $rotation_warnings,
            'product_frequency'  => $product_frequency,
            'by_category'        => $by_category
        ), 200);
    }

    // =========================================================================
    // HANDLER: CONTEXT (GET /spray-log/context)
    // =========================================================================

    /**
     * Engine context endpoint — called by cascade stage 0.5.
     * Returns recent applications structured for PGR, DMI, disease, and
     * phytotoxicity engines.
     * 
     * Query params:
     *   site_id (required)
     *   zone    (required)
     *   days    (optional, default 90)
     */
    public function handle_context($request) {
        global $wpdb;

        $site_id = sanitize_text_field($request->get_param('site_id'));
        $zone = sanitize_text_field($request->get_param('zone'));
        
        if (empty($zone)) {
            $zone = 'greens'; // sensible default
        }

        $days = min(intval($request->get_param('days') ?: 90), 365);
        $table = $wpdb->prefix . self::TABLE_SPRAY_LOG;
        $user_id = get_current_user_id();

        // Try site_id + zone first
        $entries = array();
        if (!empty($site_id)) {
            $entries = $wpdb->get_results($wpdb->prepare(
                "SELECT log_id, application_date, product_category, product_key,
                        product_name, active_ingredient, frac_group,
                        rate, rate_unit, rate_normalised, rate_normalised_unit,
                        water_volume, target, source, recommendation_id, notes
                 FROM $table
                 WHERE site_id = %s AND zone = %s
                   AND application_date >= DATE_SUB(CURDATE(), INTERVAL %d DAY)
                 ORDER BY application_date DESC",
                $site_id, $zone, $days
            ), ARRAY_A);
        }

        // Fallback: entries saved before site_id was wired have site_id = '' or NULL.
        // Only fall back for those — never return another site's entries.
        if (empty($entries) && $user_id) {
            $entries = $wpdb->get_results($wpdb->prepare(
                "SELECT log_id, application_date, product_category, product_key,
                        product_name, active_ingredient, frac_group,
                        rate, rate_unit, rate_normalised, rate_normalised_unit,
                        water_volume, target, source, recommendation_id, notes
                 FROM $table
                 WHERE user_id = %d AND zone = %s
                   AND (site_id IS NULL OR site_id = '')
                   AND application_date >= DATE_SUB(CURDATE(), INTERVAL %d DAY)
                 ORDER BY application_date DESC",
                $user_id, $zone, $days
            ), ARRAY_A);
        }

        // Structure for engine consumption
        $last_pgr = null;
        $last_fungicide = null;
        $dmi_applications = array();
        $frac_history = array();

        foreach ($entries as $entry) {
            switch ($entry['product_category']) {
                case 'pgr':
                    if ($last_pgr === null) {
                        $last_pgr = $entry;
                    }
                    break;
                case 'fungicide':
                    // Prefer entries with active ingredient data over generic ones
                    if ($last_fungicide === null) {
                        $last_fungicide = $entry;
                    } elseif (empty($last_fungicide['active_ingredient']) && !empty($entry['active_ingredient'])) {
                        $last_fungicide = $entry;
                    }
                    // Track DMI (FRAC 3) applications
                    if ($entry['frac_group'] === '3') {
                        $dmi_applications[] = $entry;
                    }
                    // Build FRAC history
                    if (!empty($entry['frac_group'])) {
                        $frac_history[] = array(
                            'frac_group'  => $entry['frac_group'],
                            'application_date'  => $entry['application_date'],
                            'product_name' => $entry['product_name'],
                            'product_category' => $entry['product_category']
                        );
                    }
                    break;
            }
        }

        return new WP_REST_Response(array(
            'success'             => true,
            'site_id'             => $site_id,
            'zone'                => $zone,
            'days'                => $days,
            'recentApplications'  => $entries,
            'lastPGR'             => $last_pgr,
            'lastFungicide'       => $last_fungicide,
            'dmiApplications'     => $dmi_applications,
            'fracHistory'         => $frac_history,
            'totalApplications'   => count($entries)
        ), 200);
    }
}

// Initialise singleton — REST routes register automatically via rest_api_init
Gilba_Spray_Log::get_instance();
