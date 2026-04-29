<?php
/*
Plugin Name: Gilba Agronomic Intelligence Hub
Description: Gilba Agronomic Intelligence Platform — soil/water/tissue analysis, disease modelling (Smith-Kerns, Fidanza, Danneberger, Bipolaris/Curvularia, Waitea, Large Patch, Red Thread), irrigation scheduling, PGR/DMI tracking, growth potential, and Word/iCal export. Designed for golf, sports turf, and councils across AU/NZ/UK/EU. See CHANGELOG.md for build history.
Version: 11.20.25
Author: Gilba Solutions
Author URI: https://gilbasolutions.com
*/

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

if ( ! defined( 'GILBA_HUB_VERSION' ) ) { define( 'GILBA_HUB_VERSION', '11.20.25' ); }
if ( ! defined( 'GILBA_ASSET_VERSION' ) ) { define( 'GILBA_ASSET_VERSION', GILBA_HUB_VERSION ); }
if ( ! defined( 'GILBA_REST_NAMESPACE' ) ) { define( 'GILBA_REST_NAMESPACE', 'gilba/v1' ); }
if ( ! defined( 'GSSH_HUB_VERSION' ) )    { define( 'GSSH_HUB_VERSION',    '1.2.0' ); }
if ( ! defined( 'GSSH_REST_NAMESPACE' ) ) { define( 'GSSH_REST_NAMESPACE', 'gssh/v1' ); }

if ( ! function_exists( 'gilba_asset_version' ) ) {
    /**
     * Return a per-asset version based on the asset file mtime.
     *
     * @param string      $relative_path Plugin-root relative path, e.g. 'assets/hub.css'.
     * @param string|null $fallback      Optional fallback version.
     * @return string
     */
    function gilba_asset_version( $relative_path, $fallback = null ) {
        $fallback = null !== $fallback ? (string) $fallback : ( defined( 'GILBA_HUB_VERSION' ) ? GILBA_HUB_VERSION : '1.0.0' );
        $relative_path = ltrim( (string) $relative_path, '/\\' );
        $asset_path = plugin_dir_path( __FILE__ ) . $relative_path;

        if ( file_exists( $asset_path ) ) {
            $mtime = filemtime( $asset_path );
            if ( false !== $mtime ) {
                return (string) $mtime;
            }
        }

        return $fallback;
    }
}

// ============================================
// HUB MODE — 'agronomic' (default) | 'stadium'
// Override in wp-config.php:
//   define( 'GILBA_HUB_MODE', 'stadium' );
// ============================================
if ( ! defined( 'GILBA_HUB_MODE' ) ) {
    define( 'GILBA_HUB_MODE', 'agronomic' );
}

// ============================================
// PREDICTION LOGGER (Phase 1 - Empirical Calibration)
// ============================================
require_once plugin_dir_path(__FILE__) . 'includes/class-gilba-prediction-logger.php';

// ============================================
// BENCHMARK CHART — [gaip_benchmark] shortcode
// ============================================
require_once plugin_dir_path(__FILE__) . 'includes/class-gilba-benchmark-chart.php';

// ============================================
// SPRAY LOG (Application Diary)
// ============================================
require_once plugin_dir_path(__FILE__) . 'includes/class-gilba-spray-log.php';

// ============================================
// APVMA SYNC (Weekly PubCRIS validation)
// Validates AU fungicide registrations against APVMA open dataset.
// No API key required — data.gov.au public endpoint.
// ============================================
require_once plugin_dir_path(__FILE__) . 'includes/class-gilba-apvma-sync.php';
Gilba_APVMA_Sync::init();

// ============================================
// b35fix299 — 2026-04-13
// Report Style Humanisation — strip AI/software tells from exported reports
//   word-export.js:
//     - Mulder's interaction icons (⚡/⚠/ℹ) removed, 📖 citation prefix removed
//     - Mulder's title changed from "X → Y" to "X suppresses Y"
//     - Mulder's title/ratio colours flattened to dark grey (#374151)
//     - → arrow prefixes removed from pH recommendations, trend status, sensor warnings
//     - Heading1 colour changed from green (#059669) to near-black (#1F2937)
//     - Pattern analysis sub-headers/bold changed from purple (#6D28D9) to black/dark grey
//     - "micronutrient" → "trace element" in 2 narrative strings
//   hub-tissue-v3.js:
//     - "micronutrient" → "trace element" in 6 interpretation strings
//     - ⚡ icon replaced with — in LED advisory
//   mulders-interaction-checker.js:
//     - Icons (⚡/⚠️/ℹ️) stripped from dashboard Mulder's panel
//     - 📖 removed from citations, ⚡ removed from summary badge
//   class-gilba-soil-interpretation.php:
//     - "micronutrient" → "trace element" (1 instance)
//   class-gilba-synthesis-interpretation.php:
//     - "micronutrient" → "trace element" (2 instances in known patterns)
//   recycled-water-nutrient-engine.js, mlsn-progressive-disclosure.js,
//   salinity-penalty.js, salinity-engine-pure.js,
//   water-progressive-disclosure-WITH-SOIL-INTERACTION.js,
//   nutrient-demand-engine.js, prebbles-products.js:
//     - "micronutrient" → "trace element" in all user-facing display strings
//     - Variable/property names left unchanged (no breaking API changes)
//   See docs/superpowers/REPORT-STYLE-GUIDE.md for full style reference
// ============================================

// ============================================
// b35fix168 — 2026-03-24
// hub-tissue-v3.js:
//   grassSpecies and construction in the domState turf snapshot now fall back
//   to GAIP_CANONICAL_STATE.turf.speciesKey / .construction when the DOM fields
//   are empty. On GSSH pages, the hub has no .gaip-grass-species or
//   .gaip-construction DOM fields. The orchestrator's computeAll (which runs
//   before hub-tissue's cascade on first load) populates GAIP_CANONICAL_STATE
//   with the correct couch/sand_carpet values from the GSSH enrichment block.
//   Fixes: soil-structure 'Unknown species unknown' on run #1, species=? in
//   C4 FIX on run #1 — both now resolved from the canonical state fallback.
// ============================================

// ============================================
// b35fix167 — 2026-03-24
// hub-orchestrator.js:
//   PATCH 1b (fix): b35fix166 PATCH 1b used a conditional guard on
//   _hubState.inputs.turf that silently failed on the first computeAll
//   because _hubState.inputs.turf starts as null (GAIP_STATE hasn't been
//   set by hub-tissue yet on page load). Replaced with Object.assign()
//   that safely initialises _hubState.inputs.turf from scratch when null.
//   This fixes GAIP_DISEASE_RESULT.species still writing "perennialRyegrass"
//   on run #1 and soil-structure "Unknown species unknown" on runs #1/#2.
// ============================================

// ============================================
// b35fix166 — 2026-03-24
// hub-orchestrator.js:
//   PATCH 1a: GSSH enrichment now injects turfType:'sports' into allInputs.turf
//             unconditionally — resolves identity enforcement turfIntentKey to
//             professionalSport and unblocks wear engine on all GSSH runs.
//   PATCH 1b: After GSSH grassSpecies resolve, writes _hubState.inputs.turf.grassSpecies
//             so hub-tissue cascade state snapshot and buildDiseaseInputs both get
//             the correct species — fixes soil-structure "unknown" fallback every run.
//   PATCH 1c: GSSH construction now reads venue DB first, then TurfProfile, then
//             hard-defaults to sand_carpet — resolves surfaceKey to sandCap.
//   PATCH 2:  buildDiseaseInputs cross-checks GAIP_STATE.turf.effectiveSpecies when
//             SpeciesController returns DEFAULT_SPECIES (perennialRyegrass) due to
//             TurfProfile timing — GAIP_DISEASE_RESULT.species now matches the actual
//             selected species, fixing dashboard species mismatch on first run.
//   PATCH 5a/b: Both GAIP_DISEASE_RESULT write sites stamp _writtenAt = Date.now()
//             for the dashboard recency check.
// daily-dashboard.js:
//   PATCH 4:  speciesMatch now passes when currentTurfSpecies is empty (TurfProfile
//             race on page load) or result is < 60s old — disease card renders instead
//             of showing "Run analysis to see disease risk" placeholder.
// class-stadium-database.php:
//   PATCH 3:  Added construction:'sand_carpet' to GIO Stadium turf data so venue DB
//             is authoritative source for surfaceKey resolution.
// ============================================

// ============================================
// ALERTS — SMS/Email threshold notifications via ClickSend
// b35fix107: gaip:orchestrator-complete → JS posts results →
// PHP evaluates thresholds, suppresses duplicates via WP options,
// delivers via ClickSend SMS and/or wp_mail.
// ============================================
require_once plugin_dir_path(__FILE__) . 'includes/class-gilba-alerts.php';
Gilba_Alerts::get_instance();

// ============================================
// STADIUM MODULE CLASSES — loaded unconditionally so gssh_hub_enqueue_stadium_assets()
// and GSSH_Stadium_Loader::enqueue_assets() can reference them regardless of GILBA_HUB_MODE.
// Instantiation is still gated on GILBA_HUB_MODE === 'stadium'.
// ============================================
require_once plugin_dir_path(__FILE__) . 'includes/class-gilba-prediction-logger.php';
require_once plugin_dir_path(__FILE__) . 'includes/class-gilba-spray-log.php';
require_once plugin_dir_path(__FILE__) . 'includes/stadium/class-stadium-database.php';
require_once plugin_dir_path(__FILE__) . 'includes/class-gssh-stadium-loader.php';

// Register activation hook for database table creation
register_activation_hook(__FILE__, array('Gilba_Prediction_Logger', 'activate'));
register_activation_hook(__FILE__, array('Gilba_Prediction_Logger', 'schedule_cron_jobs'));
register_deactivation_hook(__FILE__, array('Gilba_Prediction_Logger', 'clear_cron_jobs'));

// Spray log table creation
register_activation_hook(__FILE__, array('Gilba_Spray_Log', 'activate'));

// APVMA sync cleanup on deactivation
register_deactivation_hook(__FILE__, array('Gilba_APVMA_Sync', 'deactivate'));

// ============================================
// b35fix301b2 — GILBA DATA LAYER FOUNDATION
// Six foundation tables under the wp_gilba_data_* prefix. Renamed from
// wp_gilba_* in 301b to avoid collision with the legacy
// wp_gilba_spray_log table owned by class-gilba-spray-log.php.
// Namespace: Gilba_Data_*, includes/data/, /wp-json/gilba-data/v1/.
// Nothing in the JS calls these yet — 301c will migrate callers.
// ============================================
require_once plugin_dir_path(__FILE__) . 'includes/data/load.php';
register_activation_hook(__FILE__, array('Gilba_Data_Schema', 'activate'));

// ============================================
// LOCATION MANAGER CLASS
// ============================================
class Gilba_Location_Manager {

    const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';

    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('wp_ajax_gilba_save_location', array($this, 'ajax_save_location'));
        add_action('wp_ajax_gilba_geocode_search', array($this, 'ajax_geocode_search'));
        add_action('wp_ajax_nopriv_gilba_geocode_search', array($this, 'ajax_geocode_search'));
        add_action('wp_ajax_gilba_reverse_geocode', array($this, 'ajax_reverse_geocode'));
    }
    
    /**
     * Geocode address to coordinates using Nominatim (OpenStreetMap)
     */
    public function geocode_address($address) {
        $cache_key = 'gilba_geocode_' . md5($address);
        $cached = get_transient($cache_key);
        
        if ($cached !== false) {
            return $cached;
        }
        
        $headers = array('User-Agent' => 'Gilba Agronomic Hub WordPress Plugin/1.0');
        $timeout = array('timeout' => 10, 'headers' => $headers);
        
        // Strategy 1: Exact query as entered
        $results = $this->nominatim_search($address, $timeout);
        
        // Strategy 2: If no results, try with country codes for target markets
        // Nominatim struggles with "Business Name, Street" - adding country bias helps
        if (empty($results)) {
            $country_codes = 'au,nz,gb,us,jp,ie,de,fr,dk,se,no,fi';
            $results = $this->nominatim_search($address, $timeout, $country_codes);
        }
        
        // Strategy 3: If still nothing, strip street/drive/road qualifiers and retry
        // "Federal Golf Club, Gowrie Drive" → "Federal Golf Club"
        if (empty($results)) {
            $simplified = $this->simplify_query($address);
            if ($simplified !== $address) {
                $results = $this->nominatim_search($simplified, $timeout);
            }
        }
        
        // Strategy 4: Try as structured query - split on comma into amenity + location
        if (empty($results)) {
            $parts = array_map('trim', explode(',', $address));
            if (count($parts) >= 2) {
                // First part as amenity/name, rest as location context
                $amenity = urlencode($parts[0]);
                $location_parts = array_slice($parts, 1);
                $location_str = urlencode(implode(', ', $location_parts));
                $url = self::NOMINATIM_BASE_URL . "?amenity={$amenity}&street={$location_str}&format=json&limit=5&addressdetails=1";
                
                $response = wp_remote_get($url, $timeout);
                if (!is_wp_error($response)) {
                    $data = json_decode(wp_remote_retrieve_body($response), true);
                    if (!empty($data)) {
                        $results = $this->parse_nominatim_results($data);
                    }
                }
            }
        }
        
        // Strategy 5: Last resort - just the name part with "golf" appended if it looks like a club
        if (empty($results)) {
            $parts = array_map('trim', explode(',', $address));
            $name = $parts[0];
            $name_lower = strtolower($name);
            // If it mentions golf/club/course but Nominatim can't find it, search as POI
            if (preg_match('/golf|club|course|links|greens/i', $name_lower)) {
                $results = $this->nominatim_search($name, $timeout);
            }
        }
        
        if (empty($results)) {
            return false;
        }
        
        set_transient($cache_key, $results, 30 * DAY_IN_SECONDS);
        return $results;
    }
    
    /**
     * Execute a Nominatim search query
     */
    private function nominatim_search($query, $timeout, $country_codes = '') {
        $params = array(
            'q' => $query,
            'format' => 'json',
            'limit' => 5,
            'addressdetails' => 1
        );
        if (!empty($country_codes)) {
            $params['countrycodes'] = $country_codes;
        }
        $url = self::NOMINATIM_BASE_URL . '?' . http_build_query($params);
        
        $response = wp_remote_get($url, $timeout);
        
        if (is_wp_error($response)) {
            error_log('Gilba geocoding error: ' . $response->get_error_message());
            return array();
        }
        
        $data = json_decode(wp_remote_retrieve_body($response), true);
        if (empty($data)) {
            return array();
        }
        
        return $this->parse_nominatim_results($data);
    }
    
    /**
     * Parse Nominatim response into standardised results array
     */
    private function parse_nominatim_results($data) {
        $results = array();
        foreach ($data as $location) {
            $results[] = array(
                'lat' => floatval($location['lat']),
                'lon' => floatval($location['lon']),
                'display_name' => $location['display_name'],
                'type' => isset($location['type']) ? $location['type'] : ''
            );
        }
        return $results;
    }
    
    /**
     * Simplify a search query by stripping street/road qualifiers
     * "Federal Golf Club, Gowrie Drive" → "Federal Golf Club"
     * "Royal Melbourne, Cheltenham Road, Black Rock" → "Royal Melbourne"
     */
    private function simplify_query($address) {
        $parts = array_map('trim', explode(',', $address));
        if (count($parts) <= 1) {
            return $address;
        }
        
        // Check if any part looks like a street name
        $street_patterns = '/\b(drive|road|street|avenue|lane|boulevard|way|crescent|place|terrace|parade|circuit|close|court|st|rd|dr|ave|blvd|ln|cres|ct)\b/i';
        
        // Keep parts that don't look like street addresses
        $kept = array();
        foreach ($parts as $part) {
            if (!preg_match($street_patterns, $part)) {
                $kept[] = $part;
            }
        }
        
        // If we stripped everything, just return the first part (the name)
        if (empty($kept)) {
            return $parts[0];
        }
        
        return implode(', ', $kept);
    }
    
    /**
     * AJAX: Search for locations
     */
    public function ajax_geocode_search() {
        // Nonce check — skip for non-logged-in users (nopriv path),
        // enforce for logged-in users. Stale nonces return a refresh prompt.
        if (is_user_logged_in()) {
            if (!check_ajax_referer('gilba_hub_nonce', 'nonce', false)) {
                wp_send_json_error(array('message' => 'Session expired. Please refresh the page.', 'code' => 'nonce_expired'));
                return;
            }
        }
        
        $address = isset($_POST['address']) ? sanitize_text_field($_POST['address']) : '';
        
        if (empty($address) || strlen($address) < 3) {
            wp_send_json_error(array('message' => 'Please enter at least 3 characters'));
        }
        
        $results = $this->geocode_address($address);
        
        if ($results === false || empty($results)) {
            wp_send_json_error(array('message' => 'No locations found. Try a different search.'));
        }
        
        wp_send_json_success($results);
    }
    
    /**
     * AJAX: Reverse geocode - convert lat/lon to place name
     * Proxies Nominatim reverse to avoid CORS issues
     */
    public function ajax_reverse_geocode() {
        if (is_user_logged_in()) {
            if (!check_ajax_referer('gilba_hub_nonce', 'nonce', false)) {
                wp_send_json_error(array('message' => 'Session expired'));
                return;
            }
        }
        
        $lat = isset($_POST['lat']) ? floatval($_POST['lat']) : 0;
        $lon = isset($_POST['lon']) ? floatval($_POST['lon']) : 0;
        
        if ($lat == 0 && $lon == 0) {
            wp_send_json_error(array('message' => 'Invalid coordinates'));
            return;
        }
        
        $url = 'https://nominatim.openstreetmap.org/reverse?' . http_build_query(array(
            'lat' => $lat,
            'lon' => $lon,
            'format' => 'json',
            'zoom' => 16
        ));
        
        $response = wp_remote_get($url, array(
            'timeout' => 8,
            'headers' => array('User-Agent' => 'Gilba Agronomic Hub WordPress Plugin/1.0')
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => 'Reverse geocode failed'));
            return;
        }
        
        $data = json_decode(wp_remote_retrieve_body($response), true);
        
        if (empty($data) || !isset($data['display_name'])) {
            wp_send_json_error(array('message' => 'No results'));
            return;
        }
        
        // b35fix139: reject Nominatim results where country_code doesn't match hemisphere
        // Prevents VN/other wrong-country results for AU/NZ coordinates on boundary polygon edges
        $country_code = isset($data['address']['country_code']) ? strtolower($data['address']['country_code']) : '';
        $southern_codes = array('au','nz','za','ar','cl','br','uy','py','bo','pe','zw','bw','mz','na','ao');
        if ($lat < -10 && !empty($country_code) && !in_array($country_code, $southern_codes)) {
            wp_send_json_success(array('name' => round($lat,4).', '.round($lon,4), 'geocode_rejected' => true));
            return;
        }

        $parts = explode(',', $data['display_name']);
        $short_name = trim(implode(',', array_slice($parts, 0, 3)));
        
        wp_send_json_success(array('name' => $short_name));
    }
    public function ajax_save_location() {
        if (!check_ajax_referer('gilba_hub_nonce', 'nonce', false)) {
            wp_send_json_error(array('message' => 'Security check failed. Please refresh the page.'));
        }
        if (!current_user_can('read')) {
            wp_send_json_error(array('message' => 'Permission denied.'));
        }
        
        $lat = isset($_POST['lat']) ? floatval($_POST['lat']) : 0;
        $lon = isset($_POST['lon']) ? floatval($_POST['lon']) : 0;
        $name = isset($_POST['name']) ? sanitize_text_field($_POST['name']) : '';
        
        if (!$lat || !$lon) {
            wp_send_json_error(array('message' => 'Invalid coordinates'));
        }
        
        // Validate coordinate ranges
        if ($lat < -90 || $lat > 90 || $lon < -180 || $lon > 180) {
            wp_send_json_error(array('message' => 'Coordinates out of valid range'));
        }
        
        // Store in user meta if logged in, otherwise use cookies
        if (is_user_logged_in()) {
            $user_id = get_current_user_id();
            update_user_meta($user_id, 'gilba_latitude', $lat);
            update_user_meta($user_id, 'gilba_longitude', $lon);
            update_user_meta($user_id, 'gilba_location_name', $name);
        } else {
            // Use cookies for non-logged-in users (expires in 30 days)
            $expire = time() + (30 * DAY_IN_SECONDS);
            setcookie('gilba_latitude', $lat, $expire, COOKIEPATH, COOKIE_DOMAIN, is_ssl(), true);
            setcookie('gilba_longitude', $lon, $expire, COOKIEPATH, COOKIE_DOMAIN, is_ssl(), true);
            setcookie('gilba_location_name', $name, $expire, COOKIEPATH, COOKIE_DOMAIN, is_ssl(), true);
        }
        
        wp_send_json_success(array(
            'message' => 'Location saved successfully',
            'lat' => $lat,
            'lon' => $lon,
            'name' => $name
        ));
    }
    
    /**
     * Get saved location (from user meta or cookies)
     */
    public function get_saved_location() {
        $lat = null;
        $lon = null;
        $name = '';
        
        if (is_user_logged_in()) {
            $user_id = get_current_user_id();
            $lat = get_user_meta($user_id, 'gilba_latitude', true);
            $lon = get_user_meta($user_id, 'gilba_longitude', true);
            $name = get_user_meta($user_id, 'gilba_location_name', true);
        } else {
            // Check cookies (sanitize — cookies are user-controlled input)
            $lat = isset($_COOKIE['gilba_latitude']) ? floatval($_COOKIE['gilba_latitude']) : null;
            $lon = isset($_COOKIE['gilba_longitude']) ? floatval($_COOKIE['gilba_longitude']) : null;
            $name = isset($_COOKIE['gilba_location_name']) ? sanitize_text_field($_COOKIE['gilba_location_name']) : '';
        }
        
        if (!empty($lat) && !empty($lon)) {
            // b35fix140: validate saved name against coordinates — reject wrong-hemisphere names
            // (Nominatim bug can save e.g. Vietnamese place name for Australian coordinates)
            $clean_name = $name;
            if (!empty($name) && floatval($lat) < -10) {
                $southern_indicators = array('australia','new zealand','south africa','argentina',
                    'chile','brazil','australia','act','nsw','victoria','queensland','perth','sydney',
                    'melbourne','brisbane','adelaide','canberra','auckland','wellington','christchurch',
                    'cape town','johannesburg','durban','buenos aires','santiago');
                $name_lower = strtolower($name);
                $looks_southern = false;
                foreach ($southern_indicators as $indicator) {
                    if (strpos($name_lower, $indicator) !== false) { $looks_southern = true; break; }
                }
                // Also accept if it contains lat/lon pattern (already a coordinate fallback)
                if (!$looks_southern && preg_match('/^-?\d+\.\d+,\s*\d+/', $name)) {
                    $looks_southern = true;
                }
                if (!$looks_southern) {
                    // Saved name doesn't match southern hemisphere — use coordinates
                    $clean_name = round(floatval($lat), 4) . ', ' . round(floatval($lon), 4);
                }
            }
            return array(
                'lat' => floatval($lat),
                'lon' => floatval($lon),
                'name' => $clean_name
            );
        }
        
        // Default to Canberra Stadium if nothing saved
        return array(
            'lat' => -35.3080,
            'lon' => 149.1244,
            'name' => ''
        );
    }
}

// Initialize location manager
Gilba_Location_Manager::get_instance();

// ============================================
// AI INTERPRETATION SUPPORT v1.0.0
// ============================================

/**
 * Register AI interpretation AJAX handler
 */
add_action( 'wp_ajax_gilba_interpret_soil', 'gilba_handle_soil_interpretation' );

/**
 * Handle soil interpretation AJAX request
 */
function gilba_handle_soil_interpretation() {
    if ( ! check_ajax_referer( 'gilba_hub_nonce', 'nonce', false ) ) {
        wp_send_json_error( array( 'message' => 'Security check failed. Please refresh the page.' ) );
    }
    if ( ! current_user_can( 'read' ) ) {
        wp_send_json_error( array( 'message' => 'Permission denied.' ) );
    }
    
    // Get soil output from request
    $soil_output_raw = isset( $_POST['soil_output'] ) ? stripslashes( $_POST['soil_output'] ) : '';
    $soil_output = json_decode( $soil_output_raw, true );
    
    if ( empty( $soil_output ) || json_last_error() !== JSON_ERROR_NONE ) {
        wp_send_json_error( array( 'message' => 'Invalid soil data provided: ' . json_last_error_msg() ) );
    }
    
    // Sanitize soil_output to ensure all keys are strings
    $soil_output = gilba_sanitize_array_keys( $soil_output );
    
    // Include interpretation classes with error handling
    $includes_path = plugin_dir_path( __FILE__ ) . 'includes/';
    
    if ( ! file_exists( $includes_path . 'class-gilba-soil-interpretation.php' ) ) {
        wp_send_json_error( array( 'message' => 'Interpretation module not installed' ) );
    }
    
    try {
        require_once $includes_path . 'class-gilba-soil-interpretation.php';
        
        // Create interpreter and get interpretation
        $interpreter = new Gilba_Soil_Interpretation();
        
        if ( ! $interpreter->is_available() ) {
            wp_send_json_error( array( 
                'message' => 'AI interpretation not configured. Add GILBA_CLAUDE_API_KEY to wp-config.php' 
            ) );
        }
        
        $result = $interpreter->interpret( $soil_output );
        
        if ( ! $result['success'] ) {
            wp_send_json_error( array( 'message' => isset( $result['error'] ) ? $result['error'] : 'Interpretation failed' ) );
        }
        
        wp_send_json_success( $result );
        
    } catch ( Exception $e ) {
        error_log( '[Gilba Soil Interpretation] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
        wp_send_json_error( array( 'message' => 'Interpretation failed. Please try again.' ) );
    } catch ( Error $e ) {
        error_log( '[Gilba Soil Interpretation] Fatal: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
        wp_send_json_error( array( 'message' => 'Interpretation failed. Please try again.' ) );
    }
}

/**
 * Recursively sanitize array keys to ensure they are strings or integers
 * Prevents "Illegal offset type" errors
 */
function gilba_sanitize_array_keys( $array ) {
    if ( ! is_array( $array ) ) {
        return $array;
    }
    
    $result = array();
    foreach ( $array as $key => $value ) {
        // Convert key to string if it's not a valid type
        if ( is_array( $key ) || is_object( $key ) ) {
            $key = 'invalid_key_' . count( $result );
        }
        
        // Recursively sanitize nested arrays
        if ( is_array( $value ) ) {
            $result[ $key ] = gilba_sanitize_array_keys( $value );
        } else {
            $result[ $key ] = $value;
        }
    }
    
    return $result;
}

// ============================================
// WATER QUALITY AI INTERPRETATION
// ============================================
add_action( 'wp_ajax_gilba_interpret_water', 'gilba_handle_water_interpretation' );

/**
 * Handle water quality interpretation AJAX request
 */
function gilba_handle_water_interpretation() {
    if ( ! check_ajax_referer( 'gilba_hub_nonce', 'nonce', false ) ) {
        wp_send_json_error( array( 'message' => 'Security check failed. Please refresh the page.' ) );
    }
    if ( ! current_user_can( 'read' ) ) {
        wp_send_json_error( array( 'message' => 'Permission denied.' ) );
    }
    
    // Get water output from request
    $water_output_raw = isset( $_POST['water_output'] ) ? stripslashes( $_POST['water_output'] ) : '';
    $water_output = json_decode( $water_output_raw, true );
    
    if ( empty( $water_output ) || json_last_error() !== JSON_ERROR_NONE ) {
        wp_send_json_error( array( 'message' => 'Invalid water data provided: ' . json_last_error_msg() ) );
    }
    
    // Sanitize water_output to ensure all keys are strings
    $water_output = gilba_sanitize_array_keys( $water_output );
    
    // Include interpretation classes with error handling
    $includes_path = plugin_dir_path( __FILE__ ) . 'includes/';
    
    if ( ! file_exists( $includes_path . 'class-gilba-water-interpretation.php' ) ) {
        wp_send_json_error( array( 'message' => 'Water interpretation module not installed' ) );
    }
    
    try {
        require_once $includes_path . 'class-gilba-water-interpretation.php';
        
        // Create interpreter and get interpretation
        $interpreter = new Gilba_Water_Interpretation();
        
        if ( ! $interpreter->is_available() ) {
            wp_send_json_error( array( 
                'message' => 'AI interpretation not configured. Add GILBA_CLAUDE_API_KEY to wp-config.php' 
            ) );
        }
        
        $result = $interpreter->interpret( $water_output );
        
        if ( ! $result['success'] ) {
            wp_send_json_error( array( 'message' => isset( $result['error'] ) ? $result['error'] : 'Interpretation failed' ) );
        }
        
        wp_send_json_success( $result );
        
    } catch ( Exception $e ) {
        error_log( '[Gilba Water Interpretation] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
        wp_send_json_error( array( 'message' => 'Interpretation failed. Please try again.' ) );
    } catch ( Error $e ) {
        error_log( '[Gilba Water Interpretation] Fatal: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
        wp_send_json_error( array( 'message' => 'Interpretation failed. Please try again.' ) );
    }
}

// ============================================
// CROSS-MODULE SYNTHESIS AJAX HANDLER
// ============================================
add_action( 'wp_ajax_gilba_interpret_synthesis', 'gilba_handle_synthesis_interpretation' );

/**
 * Handle cross-module synthesis interpretation AJAX request
 */
function gilba_handle_synthesis_interpretation() {
    if ( ! check_ajax_referer( 'gilba_hub_nonce', 'nonce', false ) ) {
        wp_send_json_error( array( 'message' => 'Security check failed. Please refresh the page.' ) );
    }
    if ( ! current_user_can( 'read' ) ) {
        wp_send_json_error( array( 'message' => 'Permission denied.' ) );
    }
    
    // Get combined data from request
    $synthesis_data_raw = isset( $_POST['synthesis_data'] ) ? stripslashes( $_POST['synthesis_data'] ) : '';
    $synthesis_data = json_decode( $synthesis_data_raw, true );
    
    if ( empty( $synthesis_data ) || json_last_error() !== JSON_ERROR_NONE ) {
        wp_send_json_error( array( 'message' => 'Invalid data provided: ' . json_last_error_msg() ) );
    }
    
    // Check we have at least 2 modules
    $modules = 0;
    if ( ! empty( $synthesis_data['soil'] ) ) $modules++;
    if ( ! empty( $synthesis_data['water'] ) ) $modules++;
    if ( ! empty( $synthesis_data['tissue'] ) ) $modules++;
    
    if ( $modules < 2 ) {
        wp_send_json_error( array( 'message' => 'Cross-module analysis requires data from at least 2 modules (soil, water, or tissue).' ) );
    }
    
    // Sanitize data
    $synthesis_data = gilba_sanitize_array_keys( $synthesis_data );
    
    // Include interpretation classes
    $includes_path = plugin_dir_path( __FILE__ ) . 'includes/';
    
    if ( ! file_exists( $includes_path . 'class-gilba-synthesis-interpretation.php' ) ) {
        wp_send_json_error( array( 'message' => 'Synthesis interpretation module not installed' ) );
    }
    
    try {
        // Include base class first (synthesis extends it)
        require_once $includes_path . 'class-gilba-interpretation.php';
        require_once $includes_path . 'class-gilba-synthesis-interpretation.php';
        
        // Create interpreter and get interpretation
        $interpreter = new Gilba_Synthesis_Interpretation();
        
        if ( ! $interpreter->is_available() ) {
            wp_send_json_error( array( 
                'message' => 'AI interpretation not configured. Add GILBA_CLAUDE_API_KEY to wp-config.php' 
            ) );
        }
        
        $result = $interpreter->interpret( $synthesis_data );
        
        if ( ! $result['success'] ) {
            wp_send_json_error( array( 'message' => isset( $result['error'] ) ? $result['error'] : 'Synthesis failed' ) );
        }
        
        wp_send_json_success( $result );
        
    } catch ( Exception $e ) {
        error_log( '[Gilba Synthesis Interpretation] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
        wp_send_json_error( array( 'message' => 'Interpretation failed. Please try again.' ) );
    } catch ( Error $e ) {
        error_log( '[Gilba Synthesis Interpretation] Fatal: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
        wp_send_json_error( array( 'message' => 'Interpretation failed. Please try again.' ) );
    }
}

// =========================================================================
// LAB REPORT PARSER AJAX ENDPOINT v1.0.0
// Upload PDF/DOCX lab reports → Claude extracts soil/water/tissue results
// =========================================================================

add_action( 'wp_ajax_gilba_parse_lab_report', 'gilba_handle_lab_report_parse' );

function gilba_handle_lab_report_parse() {
    if ( ! check_ajax_referer( 'gilba_hub_nonce', 'nonce', false ) ) {
        wp_send_json_error( array( 'message' => 'Security check failed. Please refresh the page.' ) );
    }
    
    if ( ! current_user_can( 'read' ) ) {
        wp_send_json_error( array( 'message' => 'Permission denied.' ) );
    }
    
    if ( empty( $_FILES['lab_report'] ) ) {
        wp_send_json_error( array( 'message' => 'No file uploaded' ) );
    }
    
    $file = $_FILES['lab_report'];
    
    if ( $file['error'] !== UPLOAD_ERR_OK ) {
        $error_messages = array(
            UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit',
            UPLOAD_ERR_FORM_SIZE  => 'File exceeds form upload limit',
            UPLOAD_ERR_PARTIAL    => 'File only partially uploaded',
            UPLOAD_ERR_NO_FILE    => 'No file uploaded',
        );
        wp_send_json_error( array( 
            'message' => isset( $error_messages[ $file['error'] ] ) ? $error_messages[ $file['error'] ] : 'Upload error code: ' . $file['error']
        ) );
    }
    
    $includes_path = plugin_dir_path( __FILE__ ) . 'includes/';
    
    if ( ! file_exists( $includes_path . 'class-gilba-lab-parser.php' ) ) {
        wp_send_json_error( array( 'message' => 'Lab parser module not installed. Place class-gilba-lab-parser.php in /includes/' ) );
    }
    
    require_once $includes_path . 'class-gilba-lab-parser.php';
    
    $parser = new Gilba_Lab_Parser();
    
    if ( ! $parser->is_configured() ) {
        wp_send_json_error( array( 
            'message' => 'AI parsing not configured. Add GILBA_CLAUDE_API_KEY to wp-config.php' 
        ) );
    }
    
    try {
        $result = $parser->parse_file( $file );
        
        if ( $result['success'] ) {
            wp_send_json_success( $result );
        } else {
            wp_send_json_error( array( 'message' => $result['error'] ) );
        }
    } catch ( Exception $e ) {
        error_log( '[Gilba Lab Parser] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
        wp_send_json_error( array( 'message' => 'Lab report parsing failed. Please try again.' ) );
    } catch ( Error $e ) {
        error_log( '[Gilba Lab Parser] Fatal: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
        wp_send_json_error( array( 'message' => 'Lab report parsing failed. Please try again.' ) );
    }
}

// ============================================
// ENQUEUE ASSETS
// ============================================
// ============================================
// SETUP WIZARD — First-Run Detection & AJAX
// ============================================

/**
 * Check if the current user has completed the setup wizard.
 * Returns true if wizard was completed OR if user has no account (non-logged-in).
 */
function gilba_is_wizard_complete() {
    if (!is_user_logged_in()) {
        return false; // Non-logged-in users always see wizard (localStorage handles repeat)
    }
    $user_id = get_current_user_id();
    $wizard_meta = get_user_meta($user_id, 'gilba_wizard_complete', true);
    return !empty($wizard_meta);
}

/**
 * AJAX handler: Mark wizard as complete in user_meta.
 * Also stores the initial turf config chosen during wizard.
 */
function gilba_ajax_wizard_complete() {
    $nonce = isset($_POST['nonce']) ? sanitize_text_field($_POST['nonce']) : '';
    if (!wp_verify_nonce($nonce, 'gilba_hub_nonce')) {
        wp_send_json_error(array('message' => 'Invalid nonce'));
    }
    if (!current_user_can('read')) {
        wp_send_json_error(array('message' => 'Permission denied.'));
    }

    $user_id = get_current_user_id();
    $wizard_data = array(
        'completed_at' => current_time('mysql'),
        'version'      => isset($_POST['version']) ? sanitize_text_field($_POST['version']) : '1.0.0',
        'turf_type'    => isset($_POST['turf_type']) ? sanitize_text_field($_POST['turf_type']) : '',
        'species'      => isset($_POST['species']) ? sanitize_text_field($_POST['species']) : '',
        'variety'      => isset($_POST['variety']) ? sanitize_text_field($_POST['variety']) : '',
        'methodology'  => isset($_POST['methodology']) ? sanitize_text_field($_POST['methodology']) : '',
    );

    update_user_meta($user_id, 'gilba_wizard_complete', $wizard_data);

    wp_send_json_success(array(
        'message' => 'Wizard completion saved',
        'data'    => $wizard_data
    ));
}
add_action('wp_ajax_gilba_wizard_complete', 'gilba_ajax_wizard_complete');

/**
 * AJAX handler: Reset wizard (for re-onboarding or testing).
 */
function gilba_ajax_wizard_reset() {
    $nonce = isset($_POST['nonce']) ? sanitize_text_field($_POST['nonce']) : '';
    if (!wp_verify_nonce($nonce, 'gilba_hub_nonce')) {
        wp_send_json_error(array('message' => 'Invalid nonce'));
    }
    if (!current_user_can('read')) {
        wp_send_json_error(array('message' => 'Permission denied.'));
    }

    if (is_user_logged_in()) {
        $user_id = get_current_user_id();
        delete_user_meta($user_id, 'gilba_wizard_complete');
    }

    wp_send_json_success(array('message' => 'Wizard reset'));
}
add_action('wp_ajax_gilba_wizard_reset', 'gilba_ajax_wizard_reset');

// ============================================
// HYDROSIGHT API PROXY
// Server-side proxy to bypass CORS restrictions
// ============================================

/**
 * AJAX handler: Proxy requests to Hydrosight API
 * Allows browser to call Hydrosight without CORS issues
 */
function gilba_hydrosight_proxy() {
    // Verify nonce — use check_ajax_referer so expired nonces return actionable code
    if (!check_ajax_referer('gilba_hub_nonce', 'nonce', false)) {
        wp_send_json_error(array('message' => 'Session expired. Please refresh the page.', 'code' => 'nonce_expired'), 403);
        wp_die();
    }

    // Security: retrieve API key server-side — never accept from POST body.
    // This prevents the key from being visible in the browser network tab.
    $user_id = get_current_user_id();
    if (!$user_id) {
        wp_send_json_error(array('message' => 'Not logged in'), 401);
        wp_die();
    }
    $api_key = get_user_meta($user_id, 'gilba_sensor_hydrosight_key', true);
    if (empty($api_key)) {
        wp_send_json_error(array('message' => 'No Hydrosight API key configured. Please add your key in Site Settings → Sensor Data.'), 400);
        wp_die();
    }

    $endpoint = isset($_POST['endpoint']) ? sanitize_text_field($_POST['endpoint']) : '';

    if (empty($endpoint)) {
        wp_send_json_error(array('message' => 'Missing endpoint'), 400);
        wp_die();
    }

    // Validate endpoint — must start with / and contain no suspicious chars
    if (strpos($endpoint, '/') !== 0 || preg_match('/[<>"\'\\\\/]/', $endpoint)) {
        wp_send_json_error(array('message' => 'Invalid endpoint'), 400);
        wp_die();
    }

    // Build the full URL
    $base_url = 'https://api.hydrosight.au/v1';
    $url = $base_url . $endpoint;
    
    // Make the request
    $response = wp_remote_get($url, array(
        'timeout' => 30,
        'headers' => array(
            'Accept' => 'application/json',
            'x-api-key' => $api_key
        )
    ));
    
    if (is_wp_error($response)) {
        wp_send_json_error(array(
            'message' => 'API request failed: ' . $response->get_error_message()
        ), 500);
    }
    
    $status_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    
    // Parse JSON response
    $data = json_decode($body, true);
    
    if ($status_code === 200) {
        wp_send_json_success($data);
    } else {
        // Provide actionable error messages for common API failures
        $error_msg = 'API returned status ' . $status_code;
        if ($status_code === 401 || $status_code === 403) {
            $error_msg = 'Invalid or expired API key. Please verify your Hydrosight API key at gethydrosight.com.au';
        } elseif ($status_code === 404) {
            $error_msg = 'Hydrosight API endpoint not found. The API may have been updated.';
        } elseif ($status_code === 429) {
            $error_msg = 'Hydrosight API rate limit exceeded. Please wait a few minutes.';
        } elseif ($status_code >= 500) {
            $error_msg = 'Hydrosight server error (' . $status_code . '). Please try again later.';
        }
        wp_send_json_error(array(
            'message' => $error_msg,
            'status' => $status_code,
            'data' => $data
        ), $status_code);
    }
}
add_action('wp_ajax_gilba_hydrosight_proxy', 'gilba_hydrosight_proxy');

/**
 * AJAX handler: Test Hydrosight connection with a user-supplied key.
 * This is the ONLY endpoint that accepts a raw key from the browser.
 * The key is used for a single test request and never persisted server-side.
 * Requires manage_options — connection testing is an admin-only operation.
 */
function gilba_hydrosight_test_connection() {
    if (!check_ajax_referer('gilba_hub_nonce', 'nonce', false)) {
        wp_send_json_error(array('message' => 'Session expired. Please refresh the page.'), 403);
        wp_die();
    }
    if (!current_user_can('manage_options')) {
        wp_send_json_error(array('message' => 'Insufficient permissions'), 403);
        wp_die();
    }

    $api_key  = isset($_POST['api_key'])  ? sanitize_text_field(wp_unslash($_POST['api_key']))  : '';
    $endpoint = isset($_POST['endpoint']) ? sanitize_text_field(wp_unslash($_POST['endpoint'])) : '';

    if (empty($api_key) || empty($endpoint)) {
        wp_send_json_error(array('message' => 'Missing api_key or endpoint'), 400);
        wp_die();
    }
    if (strpos($endpoint, '/') !== 0 || preg_match('/[<>\"\'\\\\]/', $endpoint)) {
        wp_send_json_error(array('message' => 'Invalid endpoint'), 400);
        wp_die();
    }

    $url = 'https://api.hydrosight.au/v1' . $endpoint;
    $response = wp_remote_get($url, array(
        'timeout' => 30,
        'headers' => array('Accept' => 'application/json', 'x-api-key' => $api_key)
    ));

    if (is_wp_error($response)) {
        wp_send_json_error(array('message' => 'Connection failed: ' . $response->get_error_message()), 500);
        wp_die();
    }

    $status = wp_remote_retrieve_response_code($response);
    $data   = json_decode(wp_remote_retrieve_body($response), true);

    if ($status === 200) {
        wp_send_json_success($data);
    } else {
        $msg = ($status === 401 || $status === 403)
            ? 'Invalid API key — please check your Hydrosight credentials.'
            : 'API returned status ' . $status;
        wp_send_json_error(array('message' => $msg, 'status' => $status), $status);
    }
}
add_action('wp_ajax_gilba_hydrosight_test_connection', 'gilba_hydrosight_test_connection');

// ============================================
// SPECCONNECT API PROXY v1.0.0
// Proxies requests to api.specconnect.net:6703
// API key stays server-side, never exposed to browser.
// Supports TDR 350/300 FieldScout readings.
// WatchDog weather station calls routed through same proxy.
// ============================================
function gilba_specconnect_proxy() {
    if (!check_ajax_referer('gilba_hub_nonce', 'nonce', false)) {
        wp_send_json_error(array('message' => 'Session expired. Please refresh the page.', 'code' => 'nonce_expired'), 403);
        wp_die();
    }

    $endpoint = isset($_POST['endpoint']) ? sanitize_text_field(wp_unslash($_POST['endpoint'])) : '';

    if (empty($endpoint)) {
        wp_send_json_error(array('message' => 'Missing endpoint'), 400);
        wp_die();
    }

    // Validate endpoint format
    if (strpos($endpoint, '/api/Customer/') !== 0 || preg_match('/[<>"\'\\]/', $endpoint)) {
        wp_send_json_error(array('message' => 'Invalid endpoint'), 400);
        wp_die();
    }

    // API key: POST body takes priority (test-before-save flow), fall back to WP options
    $api_key = isset($_POST['api_key']) ? sanitize_text_field(wp_unslash($_POST['api_key'])) : '';
    if (empty($api_key)) {
        $api_key = get_option('gilba_specconnect_api_key', '');
    }
    if (empty($api_key)) {
        wp_send_json_error(array('message' => 'SpecConnect API key not configured. Add it in Site Settings → Sensor Data.'), 400);
        wp_die();
    }

    // Inject the real API key into the endpoint (replaces {key} placeholder)
    $endpoint = str_replace('{key}', urlencode($api_key), $endpoint);

    $url = 'https://api.specconnect.net:6703' . $endpoint;

    // Try with SSL verification first; some hosts block port 6703 or have cert issues
    $response = wp_remote_get($url, array(
        'timeout'   => 30,
        'sslverify' => false, // port 6703 SSL cert may not be trusted by host CA bundle
        'headers'   => array('Accept' => 'application/json'),
    ));

    if (is_wp_error($response)) {
        wp_send_json_error(array(
            'message' => 'SpecConnect connection failed: ' . $response->get_error_message() .
                         ' — check that your server can reach api.specconnect.net:6703',
            'wp_error' => $response->get_error_code(),
        ), 500);
        wp_die();
    }

    $status = wp_remote_retrieve_response_code($response);
    $body   = wp_remote_retrieve_body($response);
    $data   = json_decode($body, true);

    if ($status === 200) {
        wp_send_json_success($data);
    } else {
        $msg = 'SpecConnect API returned status ' . $status;
        if ($status === 401 || $status === 403) {
            $msg = 'Invalid SpecConnect API key. Check your key in Site Settings → Sensor Data.';
        } elseif ($status === 429) {
            $msg = 'SpecConnect rate limit reached. Please wait a few minutes.';
        } elseif ($status >= 500) {
            $msg = 'SpecConnect server error (' . $status . '). Try again later.';
        }
        wp_send_json_error(array('message' => $msg, 'status' => $status), $status);
    }
    wp_die();
}
add_action('wp_ajax_gilba_specconnect_proxy', 'gilba_specconnect_proxy');

// Save SpecConnect API key via AJAX (called from settings panel)
function gilba_specconnect_save_key() {
    if (!check_ajax_referer('gilba_hub_nonce', 'nonce', false)) {
        wp_send_json_error(array('message' => 'Nonce expired'), 403);
        wp_die();
    }
    if (!current_user_can('manage_options')) {
        wp_send_json_error(array('message' => 'Insufficient permissions'), 403);
        wp_die();
    }
    $key = isset($_POST['api_key']) ? sanitize_text_field(wp_unslash($_POST['api_key'])) : '';
    update_option('gilba_specconnect_api_key', $key);
    wp_send_json_success(array('message' => 'API key saved'));
    wp_die();
}
add_action('wp_ajax_gilba_specconnect_save_key', 'gilba_specconnect_save_key');


// ============================================
// NONCE REFRESH ENDPOINT
// Returns a fresh nonce for JS to use when the
// page-load nonce has expired (> 12 hours).
// Called automatically by sensor manager on 403.
// ============================================
function gilba_refresh_nonce() {
    if (!is_user_logged_in()) {
        wp_send_json_error(array('message' => 'Not logged in'), 401);
        wp_die();
    }
    wp_send_json_success(array(
        'nonce' => wp_create_nonce('gilba_hub_nonce')
    ));
    wp_die();
}
add_action('wp_ajax_gilba_refresh_nonce', 'gilba_refresh_nonce');


// ============================================
// SITE LIST SERVER SYNC
// Saves/loads the user's site registry to WP
// user meta so it is available on any device.
// Only the site registry (id + label) is synced
// — not samples or configs (too large for meta).
// ============================================

/**
 * Save site list to WP user meta.
 * POST: { nonce, sites: JSON string of { siteId: { label, createdAt } } }
 */
function gilba_sites_save() {
    if ( ! is_user_logged_in() ) {
        wp_send_json_error( array( 'message' => 'Not logged in' ), 401 );
        wp_die();
    }
    $nonce = isset( $_POST['nonce'] ) ? sanitize_text_field( $_POST['nonce'] ) : '';
    if ( ! wp_verify_nonce( $nonce, 'gilba_hub_nonce' ) ) {
        wp_send_json_error( array( 'message' => 'Invalid nonce' ), 403 );
        wp_die();
    }
    $raw = isset( $_POST['sites'] ) ? wp_unslash( $_POST['sites'] ) : '';
    if ( empty( $raw ) ) {
        wp_send_json_error( array( 'message' => 'No site data provided' ), 400 );
        wp_die();
    }
    $sites = json_decode( $raw, true );
    if ( ! is_array( $sites ) ) {
        wp_send_json_error( array( 'message' => 'Invalid site data format' ), 400 );
        wp_die();
    }
    // Sanitise: only persist id (key), label, createdAt per entry
    $clean = array();
    foreach ( $sites as $site_id => $site_data ) {
        $site_id = sanitize_key( $site_id );
        if ( empty( $site_id ) ) continue;
        $clean[ $site_id ] = array(
            'label'     => isset( $site_data['label'] )     ? sanitize_text_field( $site_data['label'] )     : $site_id,
            'createdAt' => isset( $site_data['createdAt'] ) ? sanitize_text_field( $site_data['createdAt'] ) : '',
        );
    }
    update_user_meta( get_current_user_id(), 'gilba_site_list', $clean );
    wp_send_json_success( array( 'saved' => count( $clean ) ) );
    wp_die();
}
add_action( 'wp_ajax_gilba_sites_save', 'gilba_sites_save' );

// ============================================
// SITE CONFIGS SYNC (full turf/location config)
// Enables cross-device species/profile sync
// ============================================

/**
 * Save full site configs (turf profile + location) to WP user meta.
 * Keyed by gilba_hub_site_configs — same key as localStorage.
 */
function gilba_site_configs_save() {
    if ( ! is_user_logged_in() ) {
        wp_send_json_error( array( 'message' => 'Not logged in' ), 401 );
        wp_die();
    }
    $nonce = isset( $_POST['nonce'] ) ? sanitize_text_field( $_POST['nonce'] ) : '';
    if ( ! wp_verify_nonce( $nonce, 'gilba_hub_nonce' ) ) {
        wp_send_json_error( array( 'message' => 'Invalid nonce' ), 403 );
        wp_die();
    }
    $raw = isset( $_POST['configs'] ) ? wp_unslash( $_POST['configs'] ) : '';
    if ( empty( $raw ) ) {
        wp_send_json_error( array( 'message' => 'No config data provided' ), 400 );
        wp_die();
    }
    $configs = json_decode( $raw, true );
    if ( ! is_array( $configs ) ) {
        wp_send_json_error( array( 'message' => 'Invalid config format' ), 400 );
        wp_die();
    }
    $clean = array();
    foreach ( $configs as $site_id => $cfg ) {
        $site_id = sanitize_key( $site_id );
        if ( empty( $site_id ) || ! is_array( $cfg ) ) continue;
        $clean[ $site_id ] = array(
            'turf'     => isset( $cfg['turf'] )     && is_array( $cfg['turf'] )     ? $cfg['turf']     : array(),
            'location' => isset( $cfg['location'] ) && is_array( $cfg['location'] ) ? $cfg['location'] : array(),
            // b35fix136: persist pgr so field log and morning briefing on other devices
            // can read PGR product/date without requiring explicit Save button click.
            'pgr'      => isset( $cfg['pgr'] )      && is_array( $cfg['pgr'] )      ? array(
                'productType'     => isset( $cfg['pgr']['productType'] )     ? sanitize_text_field( $cfg['pgr']['productType'] )     : '',
                'applicationDate' => isset( $cfg['pgr']['applicationDate'] ) ? sanitize_text_field( $cfg['pgr']['applicationDate'] ) : null,
                'rateLperHa'      => isset( $cfg['pgr']['rateLperHa'] )      ? sanitize_text_field( $cfg['pgr']['rateLperHa'] )      : null,
                'enabled'         => isset( $cfg['pgr']['enabled'] )         ? (bool) $cfg['pgr']['enabled']                        : false,
            ) : array(),
            'savedAt'  => isset( $cfg['savedAt'] )  ? sanitize_text_field( $cfg['savedAt'] )  : '',
        );
    }
    update_user_meta( get_current_user_id(), 'gilba_hub_site_configs', $clean );
    wp_send_json_success( array( 'saved' => count( $clean ) ) );
    wp_die();
}
add_action( 'wp_ajax_gilba_site_configs_save', 'gilba_site_configs_save' );

/**
 * Load full site configs from WP user meta.
 */
function gilba_site_configs_load() {
    if ( ! is_user_logged_in() ) {
        wp_send_json_error( array( 'message' => 'Not logged in' ), 401 );
        wp_die();
    }
    $nonce = isset( $_POST['nonce'] ) ? sanitize_text_field( $_POST['nonce'] ) : '';
    if ( ! wp_verify_nonce( $nonce, 'gilba_hub_nonce' ) ) {
        wp_send_json_error( array( 'message' => 'Invalid nonce' ), 403 );
        wp_die();
    }
    $configs = get_user_meta( get_current_user_id(), 'gilba_hub_site_configs', true );
    if ( empty( $configs ) || ! is_array( $configs ) ) {
        wp_send_json_success( array( 'configs' => array(), 'count' => 0 ) );
        wp_die();
    }

    // b35fix169 Fix 2: sanitise location bleed before returning to client.
    // Known stadium coords that have bled into other sites due to the DOM-read bug.
    $bleed_coords = array(
        array( 'lat' => -35.2505, 'lon' => 149.1019, 'id' => 'gio_stadium' ),
    );
    $configs_clean = $configs;
    foreach ( $configs_clean as $site_id => &$cfg ) {
        if ( empty( $cfg['location'] ) ) continue;
        $lat  = isset( $cfg['location']['lat'] )  ? floatval( $cfg['location']['lat'] )  : null;
        $lon  = isset( $cfg['location']['lon'] )  ? floatval( $cfg['location']['lon'] )  : null;
        $name = isset( $cfg['location']['name'] ) ? $cfg['location']['name']              : '';
        if ( $lat === null || $lon === null ) continue;

        $is_bleed = false;
        foreach ( $bleed_coords as $bc ) {
            if ( abs( $lat - $bc['lat'] ) < 0.0002 && abs( $lon - $bc['lon'] ) < 0.0002
                 && $site_id !== $bc['id'] ) {
                $is_bleed = true;
                break;
            }
        }
        // Also catch Vietnam name written onto southern-hemisphere coords
        if ( ! $is_bleed && $lat < -10 &&
             ( strpos( $name, 'Việt Nam' ) !== false || strpos( $name, 'Tỉnh' ) !== false ) ) {
            $is_bleed = true;
        }

        if ( $is_bleed ) {
            // Strip to bare coords — client will re-geocode on next restore
            $cfg['location'] = array(
                'lat'  => $lat,
                'lon'  => $lon,
                'name' => round( $lat, 4 ) . ', ' . round( $lon, 4 ),
            );
        }
    }
    unset( $cfg );

    wp_send_json_success( array( 'configs' => $configs_clean, 'count' => count( $configs_clean ) ) );
    wp_die();
}
add_action( 'wp_ajax_gilba_site_configs_load', 'gilba_site_configs_load' );

/**
 * Load site list from WP user meta.
 * Returns { sites: { siteId: { label, createdAt } }, count }
 */
function gilba_sites_load() {
    if ( ! is_user_logged_in() ) {
        wp_send_json_error( array( 'message' => 'Not logged in' ), 401 );
        wp_die();
    }
    $nonce = isset( $_POST['nonce'] ) ? sanitize_text_field( $_POST['nonce'] ) : '';
    if ( ! wp_verify_nonce( $nonce, 'gilba_hub_nonce' ) ) {
        wp_send_json_error( array( 'message' => 'Invalid nonce' ), 403 );
        wp_die();
    }
    $sites = get_user_meta( get_current_user_id(), 'gilba_site_list', true );
    if ( empty( $sites ) || ! is_array( $sites ) ) {
        wp_send_json_success( array( 'sites' => array(), 'count' => 0 ) );
        wp_die();
    }
    wp_send_json_success( array( 'sites' => $sites, 'count' => count( $sites ) ) );
    wp_die();
}
add_action( 'wp_ajax_gilba_sites_load', 'gilba_sites_load' );


// ============================================
// SENSOR CREDENTIALS & MAPPINGS
// Per-user storage in WordPress user meta
// ============================================

/**
 * AJAX handler: Load sensor credentials from user meta
 */
function gilba_sensor_load_credentials() {
    $nonce = isset($_POST['nonce']) ? sanitize_text_field($_POST['nonce']) : '';
    if (!wp_verify_nonce($nonce, 'gilba_hub_nonce')) {
        wp_send_json_error(array('message' => 'Invalid nonce'), 403);
    }
    
    if (!is_user_logged_in()) {
        wp_send_json_error(array('message' => 'Not logged in'), 401);
    }
    
    $user_id = get_current_user_id();
    
    // Load credentials for each vendor
    $credentials = array();
    $vendor_keys = array('hydrosight', 'soilscout', 'specconnect'); // Supported vendors
    
    foreach ($vendor_keys as $vendor) {
        $key = get_user_meta($user_id, 'gilba_sensor_' . $vendor . '_key', true);
        if (!empty($key)) {
            // Security: never return raw API key to browser.
            // JS only needs to know whether a key is configured.
            $credentials[$vendor] = array('key_set' => true);
        }
    }
    
    // Load site-sensor mappings
    $mappings = get_user_meta($user_id, 'gilba_sensor_mappings', true);
    if (empty($mappings) || !is_array($mappings)) {
        $mappings = new stdClass(); // Forces JSON {} instead of []
    }
    
    wp_send_json_success(array(
        'credentials' => $credentials,
        'siteMappings' => $mappings
    ));
}
add_action('wp_ajax_gilba_sensor_load_credentials', 'gilba_sensor_load_credentials');

/**
 * AJAX handler: Save sensor credentials to user meta
 */
function gilba_sensor_save_credentials() {
    $nonce = isset($_POST['nonce']) ? sanitize_text_field($_POST['nonce']) : '';
    if (!wp_verify_nonce($nonce, 'gilba_hub_nonce')) {
        wp_send_json_error(array('message' => 'Invalid nonce'), 403);
    }
    
    if (!is_user_logged_in()) {
        wp_send_json_error(array('message' => 'Not logged in'), 401);
    }
    
    $user_id = get_current_user_id();
    $vendor_id = isset($_POST['vendor_id']) ? sanitize_key($_POST['vendor_id']) : '';
    $api_key = isset($_POST['api_key']) ? sanitize_text_field($_POST['api_key']) : '';
    
    // Validate vendor ID
    $allowed_vendors = array('hydrosight', 'soilscout', 'specconnect');
    if (!in_array($vendor_id, $allowed_vendors)) {
        wp_send_json_error(array('message' => 'Invalid vendor'), 400);
    }
    
    $meta_key = 'gilba_sensor_' . $vendor_id . '_key';
    
    if (empty($api_key)) {
        // Delete the key
        delete_user_meta($user_id, $meta_key);
    } else {
        // Save the key
        update_user_meta($user_id, $meta_key, $api_key);
    }
    
    wp_send_json_success(array('message' => 'Credentials saved'));
}
add_action('wp_ajax_gilba_sensor_save_credentials', 'gilba_sensor_save_credentials');

/**
 * AJAX handler: Save site-sensor mappings to user meta
 */
function gilba_sensor_save_mappings() {
    $nonce = isset($_POST['nonce']) ? sanitize_text_field($_POST['nonce']) : '';
    if (!wp_verify_nonce($nonce, 'gilba_hub_nonce')) {
        wp_send_json_error(array('message' => 'Invalid nonce'), 403);
    }
    
    if (!is_user_logged_in()) {
        wp_send_json_error(array('message' => 'Not logged in'), 401);
    }
    
    $user_id = get_current_user_id();
    $mappings_json = isset($_POST['mappings']) ? wp_unslash($_POST['mappings']) : '{}';
    
    $mappings = json_decode($mappings_json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        wp_send_json_error(array('message' => 'Invalid JSON'), 400);
    }
    
    // Sanitize the mappings structure
    $sanitized = array();
    if (is_array($mappings)) {
        foreach ($mappings as $site_id => $vendors) {
            $site_id = sanitize_key($site_id);
            if (is_array($vendors)) {
                $sanitized[$site_id] = array();
                foreach ($vendors as $vendor_id => $sensor_ids) {
                    $vendor_id = sanitize_key($vendor_id);
                    if (is_array($sensor_ids)) {
                        $sanitized[$site_id][$vendor_id] = array_map('sanitize_text_field', $sensor_ids);
                    }
                }
            }
        }
    }
    
    update_user_meta($user_id, 'gilba_sensor_mappings', $sanitized);
    
    wp_send_json_success(array('message' => 'Mappings saved'));
}
add_action('wp_ajax_gilba_sensor_save_mappings', 'gilba_sensor_save_mappings');


// ============================================================
// LOGO MANAGEMENT
// ============================================================

function gilba_logo_get() {
    if (!check_ajax_referer('gilba_hub_nonce', 'nonce', false)) {
        wp_send_json_error(array('message' => 'Security check failed.'));
    }
    if (!current_user_can('read')) {
        wp_send_json_error(array('message' => 'Permission denied.'));
    }
    $user_id = get_current_user_id();
    $logos = get_user_meta($user_id, 'gaip_report_logos', true);
    if (!is_array($logos)) $logos = array();
    wp_send_json_success(array('logos' => $logos));
}
add_action('wp_ajax_gilba_logo_get', 'gilba_logo_get');

function gilba_logo_save() {
    if (!check_ajax_referer('gilba_hub_nonce', 'nonce', false)) {
        wp_send_json_error(array('message' => 'Security check failed.'));
    }
    if (!current_user_can('read')) {
        wp_send_json_error(array('message' => 'Permission denied.'));
    }
    $name   = isset($_POST['name'])   ? sanitize_text_field($_POST['name'])   : 'Logo';
    $base64 = isset($_POST['base64']) ? $_POST['base64']                      : '';
    $width  = isset($_POST['width'])  ? intval($_POST['width'])                : 0;
    $height = isset($_POST['height']) ? intval($_POST['height'])               : 0;
    $type   = isset($_POST['type'])   ? sanitize_text_field($_POST['type'])   : 'image/png';

    // Validate base64 is a data URI for an image
    if (!preg_match('/^data:image\/(png|jpeg|gif|webp);base64,/', $base64)) {
        wp_send_json_error(array('message' => 'Invalid image data.'));
    }
    // Rough size check: base64 of 500KB ≈ 680KB string
    if (strlen($base64) > 700000) {
        wp_send_json_error(array('message' => 'Logo too large (max ~500KB).'));
    }

    $user_id = get_current_user_id();
    $logos = get_user_meta($user_id, 'gaip_report_logos', true);
    if (!is_array($logos)) $logos = array();

    $id = 'logo_' . uniqid();
    $logos[] = array(
        'id'     => $id,
        'name'   => $name,
        'base64' => $base64,
        'width'  => $width,
        'height' => $height,
        'type'   => $type,
    );

    update_user_meta($user_id, 'gaip_report_logos', $logos);
    wp_send_json_success(array('id' => $id, 'name' => $name));
}
add_action('wp_ajax_gilba_logo_save', 'gilba_logo_save');

function gilba_logo_delete() {
    if (!check_ajax_referer('gilba_hub_nonce', 'nonce', false)) {
        wp_send_json_error(array('message' => 'Security check failed.'));
    }
    if (!current_user_can('read')) {
        wp_send_json_error(array('message' => 'Permission denied.'));
    }
    $id = isset($_POST['id']) ? sanitize_text_field($_POST['id']) : '';
    if (!$id) wp_send_json_error(array('message' => 'No ID.'));

    $user_id = get_current_user_id();
    $logos = get_user_meta($user_id, 'gaip_report_logos', true);
    if (!is_array($logos)) $logos = array();

    $logos = array_values(array_filter($logos, function($l) use ($id) {
        return $l['id'] !== $id;
    }));
    update_user_meta($user_id, 'gaip_report_logos', $logos);

    // Also clear selected if it was this logo
    $selected = get_user_meta($user_id, 'gaip_selected_logo_id', true);
    if ($selected === $id) {
        delete_user_meta($user_id, 'gaip_selected_logo_id');
    }

    wp_send_json_success(array('message' => 'Deleted.'));
}
add_action('wp_ajax_gilba_logo_delete', 'gilba_logo_delete');

function gilba_logo_select() {
    if (!check_ajax_referer('gilba_hub_nonce', 'nonce', false)) {
        wp_send_json_error(array('message' => 'Security check failed.'));
    }
    if (!current_user_can('read')) {
        wp_send_json_error(array('message' => 'Permission denied.'));
    }
    $id = isset($_POST['id']) ? sanitize_text_field($_POST['id']) : '';
    $user_id = get_current_user_id();
    if ($id) {
        update_user_meta($user_id, 'gaip_selected_logo_id', $id);
    } else {
        delete_user_meta($user_id, 'gaip_selected_logo_id');
    }
    wp_send_json_success(array('message' => 'Selection saved.'));
}
add_action('wp_ajax_gilba_logo_select', 'gilba_logo_select');


// ============================================
// SHORTCODE MODE DETECTION HELPER
// Returns true if the post's [gaip_hub] shortcode has mode="stadium"
// Used by enqueue functions (which run before shortcode render).
// ============================================
function gilba_page_has_stadium_mode( $post ) {
    if ( ! is_a( $post, 'WP_Post' ) ) {
        return false;
    }
    if ( ! has_shortcode( $post->post_content, 'gaip_hub' ) ) {
        return false;
    }
    // Quick regex scan of shortcode attributes in post content
    if ( preg_match( '/\[gaip_hub[^\]]*\bmode\s*=\s*["\']?stadium["\']?/i', $post->post_content ) ) {
        return true;
    }
    return false;
}

function gaip_hub_enqueue_assets() {
    // Only load assets on pages/posts that use the shortcode
    global $post;
    if (!is_a($post, 'WP_Post') || !has_shortcode($post->post_content, 'gaip_hub')) {
        return;
    }

    // If the [gaip_hub mode="stadium"] attribute is present, the stadium enqueue
    // function handles assets instead. Skip agronomic assets for that page.
    if ( gilba_page_has_stadium_mode( $post ) ) {
        return;
    }
    
    $plugin_url = plugins_url( '', __FILE__ );

    // Google Fonts — Barlow (UI), DM Mono (data), Fraunces (display)
    wp_enqueue_style(
        'gaip-google-fonts',
        'https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600&display=swap',
        array(),
        null
    );

    wp_register_style(
        'gaip-hub-css',
        $plugin_url . '/assets/hub.css',
        array(),
        gilba_asset_version( 'assets/hub.css' )
    );
    wp_enqueue_style('gaip-hub-css');

    // Leaflet map for location picker
    wp_enqueue_style(
        'leaflet-css',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
        array(),
        '1.9.4'
    );
    wp_enqueue_script(
        'leaflet-js',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        array(),
        '1.9.4',
        true
    );

    // Tissue testing CSS
    wp_enqueue_style(
        'gaip-tissue-css',
        $plugin_url . '/assets/tissue.css',
        array(),
        gilba_asset_version( 'assets/tissue.css' )
    );

    // Column collapse fix - prevents table columns from collapsing to zero width
    // Fixes tissue table and TDR table character-by-character vertical text wrapping
    wp_enqueue_style(
        'gaip-column-collapse-fix',
        $plugin_url . '/assets/column-collapse-fix.css',
        array('gaip-tissue-css', 'gaip-hub-css'),
        gilba_asset_version( 'assets/column-collapse-fix.css' )
    );

    // ========================================
    // GILBA HUB V2 CORE - MUST LOAD FIRST
    // Centralised state, events, orchestrator, species controller
    // Legacy shim ensures all v1 modules continue working
    // Debug mode: add ?gilba_debug=1 to URL
    // ========================================
    wp_enqueue_script(
        'gilba-hub-v2-core',
        $plugin_url . '/assets/gilba-hub-v2.js',
        array(),          // No dependencies - this is the root
        gilba_asset_version( 'assets/gilba-hub-v2.js' ),
        false             // Load in <head> so it's ready before v1 scripts
    );

    // b35fix309: Version stamp moved to PHP via wp_add_inline_script.
    // b35fix315: hardcoded fallback in gilba-hub-v2.js REMOVED so this
    // inline injection is the TRUE single source of truth. Autoptimize's
    // /cache/min/1/ was caching a pre-b35fix309 minified bundle that kept
    // re-asserting "10.9.9" after the inline ran, silently stamping stale
    // versions in docx exports. With the in-bundle fallback gone, a missing
    // inline surfaces as 'unknown' in the docx footer (visible deploy issue)
    // rather than a confidently-wrong hardcoded string.
    wp_add_inline_script(
        'gilba-hub-v2-core',
        'window.GAIP_HUB_VERSION = ' . wp_json_encode( GILBA_HUB_VERSION ) . ';',
        'after'
    );

    // ========================================
    // GROWTH POTENTIAL ENGINE v1.0.0 (b35fix302a)
    // Pure, tested canonical implementation of the PACE Turf GP model
    // (Gelernter & Stowell 2005) and Kreuser & Soldat 2011 plateau variant.
    // Loaded early — future consumers (climate, nutrition, event planner,
    // word export) will be rewired onto it in b35fix302c. Inert until then.
    // ========================================
    wp_enqueue_script(
        'gilba-growth-potential-engine',
        $plugin_url . '/assets/growth-potential-engine.js',
        array('gilba-hub-v2-core'),  // Only depends on v2 core
        gilba_asset_version( 'assets/growth-potential-engine.js' ),
        false  // Load in <head> so it's available before any consumer
    );

    // ========================================
    // NUTRITION REQUIREMENT ENGINE v1.0.0 (b35fix302b)
    // Pure, tested nutrition engine — per-sample P/K/S/Ca/Mg from soil
    // chemistry (MLSN with Woods/Stowell/Gelernter 2016 thresholds) plus
    // facility-level GP-weighted monthly N distribution. Delegates all GP
    // math to growth-potential-engine (302a). Fixes Jerry's reported bug
    // where every green got identical fert recs in combined export (stale
    // GAIP_NUTRITION_SOIL_CACHE). Consumers rewired in subsequent sub-fixes.
    // ========================================
    wp_enqueue_script(
        'gilba-nutrition-requirement-engine',
        $plugin_url . '/assets/nutrition-requirement-engine.js',
        array('gilba-growth-potential-engine'),  // Depends on GP engine
        gilba_asset_version( 'assets/nutrition-requirement-engine.js' ),
        false  // Load in <head> alongside GP engine
    );

    // ========================================
    // CLIMATE ENGINE v2.0.0 (Phase 2 extraction)
    // Pure calculation engine registered with v2 EngineRegistry
    // Async fetcher + sync compute, legacy shim mirrors to window.climateMetrics
    // Replaces climate-engine.js calculation logic; v1 file kept for compatibility
    // ========================================
    wp_enqueue_script(
        'gilba-climate-engine-v2',
        $plugin_url . '/assets/climate-engine-v2.js',
        array('gilba-hub-v2-core'),  // Only depends on v2 core
        gilba_asset_version( 'assets/climate-engine-v2.js' ),
        false  // Load in <head> alongside v2 core so it registers before v1 scripts run
    );

    // ========================================
    // SHARED UTILITIES v1.0.0
    // Canonical clamp, formatDate, monthNames, isC4Species
    // All modules should use GAIP_Utils instead of local copies
    // ========================================
    wp_enqueue_script(
        'gaip-utils',
        $plugin_url . '/assets/gaip-utils.js',
        array('gilba-hub-v2-core'),  // Depends on v2 core
        gilba_asset_version( 'assets/gaip-utils.js' ),
        true
    );

    // ========================================
    // SPECIES CONTROLLER v1.0.0 - MUST LOAD EARLY
    // Single Source of Truth for species identity
    // ALL modules must use SpeciesController.getSpecies() etc.
    // ========================================
    wp_enqueue_script(
        'gaip-species-controller',
        $plugin_url . '/assets/species-controller.js',
        array('gaip-utils'),  // Depends on shared utils
        gilba_asset_version( 'assets/species-controller.js' ),
        true
    );

    // ========================================
    // IDENTITY ENFORCEMENT v1.0.0
    // Tiered validation of primary identity keys
    // TIER 0: speciesKey (hard fail)
    // TIER 1: surfaceKey, climateRegimeKey, turfIntentKey (soft default)
    // TIER 2: Output gating based on assumptions
    // ========================================
    wp_enqueue_script(
        'gaip-identity-enforcement',
        $plugin_url . '/assets/identity-enforcement.js',
        array('gaip-species-controller'),
        gilba_asset_version( 'assets/identity-enforcement.js' ),
        true
    );

    // ========================================
    // CLIMATE ENGINE v1 (legacy — being replaced by climate-engine-v2.js)
    // Retained for UI integration code not yet migrated to v2
    // v2 handles all calculations; v1 will be removed once downstream migration complete
    // ========================================
    wp_enqueue_script(
        'gaip-climate-engine',
        $plugin_url . '/assets/climate-engine.js',
        array('gilba-climate-engine-v2', 'gaip-species-controller'),  // v2 loads first
        gilba_asset_version( 'assets/climate-engine.js' ),
        true
    );

    // ========================================
    // WEATHER RESILIENCE v1.0
    // Caching and graceful degradation for weather API
    // ========================================
    wp_enqueue_script(
        'gaip-weather-resilience',
        $plugin_url . '/assets/weather-resilience.js',
        array('gaip-climate-engine'),  // Depends on climate engine
        gilba_asset_version( 'assets/weather-resilience.js' ),
        true
    );

    // ========================================
    // AMBIENT DLI ENGINE v1.0
    // Auto-calculates Daily Light Integral from Open-Meteo solar radiation
    // Source: McCree (1972), Faust & Logan (2018)
    // Provides "open-field" DLI baseline for shade deficit calculations
    // ========================================
    wp_enqueue_script(
        'gaip-ambient-dli-engine',
        $plugin_url . '/assets/ambient-dli-engine.js',
        array('gaip-species-controller', 'gaip-climate-engine'),
        gilba_asset_version( 'assets/ambient-dli-engine.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-ambient-dli-integration',
        $plugin_url . '/assets/ambient-dli-integration.js',
        array('gaip-ambient-dli-engine', 'gaip-climate-engine'),
        gilba_asset_version( 'assets/ambient-dli-integration.js' ),
        true
    );

    // ========================================
    // GAIP SOIL TEMPERATURE INTEGRATION v1.0
    // Physics-based soil temperature model (Crank-Nicolson 1-D heat diffusion)
    // Multi-depth outputs for disease/overseed/germination
    // ========================================
    wp_enqueue_script(
        'gaip-soil-temp-integration',
        $plugin_url . '/assets/gaip-soil-temp-integration.js',
        array('gaip-climate-engine'),  // Depends on climate engine
        gilba_asset_version( 'assets/gaip-soil-temp-integration.js' ),
        true
    );

    // ========================================
    // REGIONAL PROFILES v1.0.0
    // Location-aware turf management data
    // Disease pressure, variety databases, climate characteristics
    // ========================================
    wp_enqueue_script(
        'gaip-regional-profiles',
        $plugin_url . '/assets/regional-profiles.js',
        array(),  // No dependencies - loads early
        gilba_asset_version( 'assets/regional-profiles.js' ),  // Cache busting (was hardcoded '1.0.2')
        true
    );

    // ========================================
    // VARIETY TRAITS (must load before turf profile for hemisphere detection)
    // v1.14.1: SpeciesController integration for couch/bermuda mapping
    // ========================================
    wp_enqueue_script(
        'gaip-variety-traits',
        $plugin_url . '/assets/gilba-variety-traits.js',
        array('gaip-species-controller'),
        gilba_asset_version( 'assets/gilba-variety-traits.js' ),
        true
    );

    // UK/European variety traits (BSPB/STRI data)
    // Used for Northern Hemisphere locations (>45°N)
    // v1.4.0: Split bentgrass into species-specific functions (creeping vs browntop)
    wp_enqueue_script(
        'gaip-uk-variety-traits',
        $plugin_url . '/assets/uk-variety-traits.js',
        array('gaip-variety-traits'),
        gilba_asset_version( 'assets/uk-variety-traits.js' ),
        true
    );

    // Scanturf variety traits (Nordic trials)
    // Used for Scandinavia (>54°N, Nordic countries)
    wp_enqueue_script(
        'gaip-scanturf-variety-traits',
        $plugin_url . '/assets/scanturf-variety-traits.js',
        array('gaip-variety-traits'),
        gilba_asset_version( 'assets/scanturf-variety-traits.js' ),
        true
    );

    // GEVES variety traits (French/Continental Europe)
    // Used for Continental Europe (France, Belgium, Netherlands)
    wp_enqueue_script(
        'gaip-geves-variety-traits',
        $plugin_url . '/assets/geves-variety-traits.js',
        array('gaip-variety-traits'),
        gilba_asset_version( 'assets/geves-variety-traits.js' ),
        true
    );

    // BSA variety traits (German trials)
    // Used for Germany - Bundessortenamt Rasengräser data (PRG + Bentgrass)
    wp_enqueue_script(
        'gaip-bsa-variety-traits',
        $plugin_url . '/assets/bsa-variety-traits.js',
        array('gaip-variety-traits'),
        gilba_asset_version( 'assets/bsa-variety-traits.js' ),
        true
    );

    // Japan variety traits
    // Used for Japan - Zoysia, Bentgrass, PRG overseed (NTEP-sourced)
    wp_enqueue_script(
        'gaip-japan-variety-traits',
        $plugin_url . '/assets/japan-variety-traits.js',
        array('gaip-variety-traits'),
        gilba_asset_version( 'assets/japan-variety-traits.js' ),
        true
    );

    // Scandinavia variety traits
    // Used for Sweden, Norway, Denmark, Finland - SCANTURF 2024-2025 trial data
    wp_enqueue_script(
        'gaip-scandinavia-variety-traits',
        $plugin_url . '/assets/scandinavia-variety-traits.js',
        array('gaip-variety-traits'),
        gilba_asset_version( 'assets/scandinavia-variety-traits.js' ),
        true
    );

    // Exclude all variety trait files from minification.
    // gilba-variety-traits.js is 7000+ lines of object literals.
    // Autoptimize / WP Rocket corrupt large object literals during minification,
    // leaving VARIETY_TRAITS species keys empty at runtime (varieties: 1 bug).
    wp_script_add_data('gaip-variety-traits',             'exclude-from-minification', true);
    wp_script_add_data('gaip-uk-variety-traits',          'exclude-from-minification', true);
    wp_script_add_data('gaip-scanturf-variety-traits',    'exclude-from-minification', true);
    wp_script_add_data('gaip-geves-variety-traits',       'exclude-from-minification', true);
    wp_script_add_data('gaip-bsa-variety-traits',         'exclude-from-minification', true);
    wp_script_add_data('gaip-japan-variety-traits',       'exclude-from-minification', true);
    wp_script_add_data('gaip-scandinavia-variety-traits', 'exclude-from-minification', true);
    wp_script_add_data('gaip-nz-fine-fescue-traits',      'exclude-from-minification', true);

    // ========================================
    // NZ FINE FESCUE VARIETY TRAITS v1.0.0
    // Chewings, Slender Creeping Red, Strong Creeping Red
    // NZ ONLY (fine fescues don't tolerate Australian summers)
    // Data: NTEP 2014/2020, BSPB 2025, NZ supplier data (PGG Wrightson, Living Turf)
    // ========================================
    wp_enqueue_script(
        'gaip-nz-fine-fescue-traits',
        $plugin_url . '/assets/nz-fine-fescue-traits.js',
        array('gaip-variety-traits'),
        gilba_asset_version( 'assets/nz-fine-fescue-traits.js' ),
        true
    );

    // ========================================
    // NAMESPACED LOCALSTORAGE SHIM
    // Must load before any module that reads/writes localStorage.
    // Sets GILBA_PLUGIN_NS = "gaip" so keys are prefixed gilba_gaip_*
    // and do not collide with GSSH keys.
    // ========================================
    wp_enqueue_script(
        'gilba-storage-ns',
        $plugin_url . '/assets/gilba-storage-ns.js',
        array(),
        gilba_asset_version( 'assets/gilba-storage-ns.js' ),
        true
    );
    wp_add_inline_script( 'gilba-storage-ns', 'window.GILBA_PLUGIN_NS = "gaip";', 'before' );

    // b35fix271: Site context — single source of truth for active site/venue ID.
    // Must load after GILBA_PLUGIN_NS is set (gilba-storage-ns) and before any
    // module that reads site ID (spray-log-cascade, site-config-persistence, etc.)
    wp_enqueue_script(
        'gaip-site-context',
        $plugin_url . '/assets/gaip-site-context.js',
        array('gilba-storage-ns'),
        gilba_asset_version( 'assets/gaip-site-context.js' ),
        true
    );

    // One-time migration: copies pre-b35fix91 bare localStorage keys to namespaced equivalents.
    wp_enqueue_script(
        'gilba-storage-migrate',
        $plugin_url . '/assets/gilba-storage-migrate.js',
        array('gilba-storage-ns'),
        gilba_asset_version( 'assets/gilba-storage-migrate.js' ),
        true
    );

    // ========================================
    // TURF PROFILE CONTROLLER v2.9.1
    // Foundational context - must load early
    // Location Preloader — runs BEFORE TurfProfileController to set correct
    // per-site coordinates in DOM inputs. Prevents region detection on stale
    // PHP-injected coords from WP user_meta.
    // ========================================
    wp_enqueue_script(
        'gaip-location-preloader',
        $plugin_url . '/assets/location-preloader.js',
        array('gilba-storage-ns'), // Shim must be loaded first
        gilba_asset_version( 'assets/location-preloader.js' ),
        true
    );

    // Manages turf type, species, variety cascading
    // Full regional variety selection (UK/Scanturf/GEVES/BSA/Japan/Scandinavia/NTEP/NZ Fine Fescue)
    // v2.9.1: Added NZ Fine Fescue species support
    // ========================================
    wp_enqueue_script(
        'gaip-turf-profile-controller',
        $plugin_url . '/assets/turf-profile-controller.js',
        array('gaip-variety-traits', 'gaip-location-preloader', 'gaip-regional-profiles', 'gaip-uk-variety-traits', 'gaip-scanturf-variety-traits', 'gaip-geves-variety-traits', 'gaip-bsa-variety-traits', 'gaip-japan-variety-traits', 'gaip-scandinavia-variety-traits', 'gaip-nz-fine-fescue-traits'),
        gilba_asset_version( 'assets/turf-profile-controller.js' ),
        true
    );

    // ========================================
    // NITROGEN PROGRAM VALIDATOR v1.0
    // Compares applied N vs growth-limited demand
    // Source: PACE Turf GP model, Carrow, Christians
    // ========================================
    wp_enqueue_script(
        'gaip-nitrogen-validator',
        $plugin_url . '/assets/nitrogen-validator.js',
        array('gaip-climate-engine'),
        gilba_asset_version( 'assets/nitrogen-validator.js' ),
        true
    );

    // ========================================
    // WEAR & RECOVERY ENGINE v1.5 (pure)
    // Source: Baker/Gibbs/Adams STRI 1989/1992, GMA UK, Gilba Solutions
    // v1.5: Salinity penalty + stress aggregation integration
    // Pure function extraction — legacy wear-recovery-engine.js retired
    // ========================================
    wp_enqueue_script(
        'gaip-wear-recovery-engine',
        $plugin_url . '/assets/wear-recovery-engine-pure.js',
        array(),  // No dependencies
        gilba_asset_version( 'assets/wear-recovery-engine-pure.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-wear-recovery-integration',
        $plugin_url . '/assets/wear-recovery-integration.js',
        array('gaip-wear-recovery-engine'),
        gilba_asset_version( 'assets/wear-recovery-integration.js' ),
        true
    );

    // ========================================
    // OVERSEED WEAR MULTIPLIER v1.0
    // Enhanced species-aware overseed tolerance adjustment
    // Source: Auburn, Clemson, NTEP wear trials
    // ========================================
    wp_enqueue_script(
        'gaip-overseed-multiplier',
        $plugin_url . '/assets/overseed-multiplier.js',
        array('gaip-wear-recovery-engine'),
        gilba_asset_version( 'assets/overseed-multiplier.js' ),
        true
    );

    // ========================================
    // OVERSEED CLIMATE INTEGRATION v1.0
    // Temperature-dependent germination, establishment, and transition
    // Source: Beard (1973), Christians (2016), PACE Turf
    // v1.2.0: GAIP physics-based soil temp integration
    // v1.2.1: Fixed isC4Base detection for PRG-as-species overseed scenarios
    //         Now infers C4 base when C3 selected in C4-viable climate
    //         Auto-calculates seasonal c3Fraction, dispatches gilbaOverseedFractionUpdate
    // ========================================
    wp_enqueue_script(
        'gaip-overseed-climate',
        $plugin_url . '/assets/overseed-climate-integration.js',
        array('gaip-overseed-multiplier', 'gaip-climate-v2'),
        gilba_asset_version( 'assets/overseed-climate-integration.js' ),
        true
    );

    // ========================================
    // SHADE ENGINE v3.0 (pure)
    // Source: CanopyFlux solar geometry, Gilba Solutions
    // v2.0: N adjustment, Mowing height, PGR warning, Seasonal trajectory
    // v2.1: Respects effective species when overseed is dominant
    // Pure function extraction — legacy shade-engine.js retired
    // ========================================
    wp_enqueue_script(
        'gaip-shade-engine',
        $plugin_url . '/assets/shade-engine-pure.js',
        array(),  // No dependencies
        gilba_asset_version( 'assets/shade-engine-pure.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-shade-integration',
        $plugin_url . '/assets/shade-integration.js',
        array('gaip-shade-engine'),
        gilba_asset_version( 'assets/shade-integration.js' ),
        true
    );

    // ========================================
    // DLI-RECOVERY BRIDGE v1.0.0
    // Connects Shade Engine DLI output to Wear Recovery modifiers
    // Species-specific recovery penalties based on DLI vs min/target/optimal
    // Source: Wherley et al. (2005), Trappe et al. (2011), Bunnell et al. (2005),
    //         Bell & Danneberger (1999)
    // ========================================
    wp_enqueue_script(
        'gaip-dli-recovery-bridge',
        $plugin_url . '/assets/dli-recovery-bridge.js',
        array('gaip-utils', 'gaip-shade-engine'),
        gilba_asset_version( 'assets/dli-recovery-bridge.js' ),
        true
    );

    wp_enqueue_style(
        'gaip-shade-ui-css',
        $plugin_url . '/assets/shade-ui.css',
        array('gaip-hub-css'),
        gilba_asset_version( 'assets/shade-ui.css' )
    );

    // ========================================
    // CLASSIFICATION CONSTANTS v1.0.0 (b35fix301a)
    // Single source of truth for MLSN/SLAN/AA thresholds, pH adjustments,
    // retest policy, and methodology resolver. Must load before any consumer
    // that reads window.GilbaClassificationConstants.
    // Source: Woods, Stowell, Gelernter 2016 (PeerJ Preprints 4:e2144v1).
    // ========================================
    wp_enqueue_script(
        'gaip-classification-constants',
        $plugin_url . '/assets/gaip-classification-constants.js',
        array(),
        gilba_asset_version( 'assets/gaip-classification-constants.js' ),
        true
    );

    // ========================================
    // MAIN HUB (SSOT mode - routes through cascade orchestrator)
    // ========================================
    wp_enqueue_script(
    'gaip-hub-js',
    plugins_url('assets/hub-tissue-v3.js', __FILE__),
    array('gaip-classification-constants', 'gaip-climate-engine', 'gaip-wear-recovery-integration', 'gaip-shade-engine', 'gaip-cascade-orchestrator'),
    gilba_asset_version( 'assets/hub-tissue-v3.js' ),
    true
    );

    // Tissue testing scripts
    wp_enqueue_script(
        'gaip-tissue-engine',
        $plugin_url . '/assets/tissue-engine.js',
        array(),
        gilba_asset_version( 'assets/tissue-engine.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-tissue-interpretation',
        $plugin_url . '/assets/tissue-interpretation.js',
        array('gaip-tissue-engine'),
        gilba_asset_version( 'assets/tissue-interpretation.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-soil-tissue-integration',
        $plugin_url . '/assets/soil-tissue-integration.js',
        array('gaip-tissue-interpretation'),
        gilba_asset_version( 'assets/soil-tissue-integration.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-tissue-ui',
        $plugin_url . '/assets/tissue-ui.js',
        array('gaip-tissue-interpretation', 'gaip-soil-tissue-integration'),
        gilba_asset_version( 'assets/tissue-ui.js' ),
        true
    );

    // ========================================
    // PROGRESSIVE DISCLOSURE MODULES
    // ========================================
    
    // MLSN Progressive Disclosure
    wp_enqueue_script(
        'gaip-mlsn-progressive',
        $plugin_url . '/assets/mlsn-progressive-disclosure.js',
        array('gaip-hub-js'),
        gilba_asset_version( 'assets/mlsn-progressive-disclosure.js' ),
        true
    );

    // Mulder's Nutrient Interaction Checker — runs after MLSN/SLAN/AA sufficiency
    wp_enqueue_script(
        'gaip-mulders',
        $plugin_url . '/assets/mulders-interaction-checker.js',
        array('gaip-mlsn-progressive'),
        gilba_asset_version( 'assets/mulders-interaction-checker.js' ),
        true
    );

    wp_enqueue_style(
        'gaip-mlsn-progressive-css',
        $plugin_url . '/assets/mlsn-progressive-disclosure.css',
        array('gaip-hub-css'),
        gilba_asset_version( 'assets/mlsn-progressive-disclosure.css' )
    );

    // b35fix311: bulk-area modal styling. Depends on the main hub CSS for design
    // tokens (colours, radii, typography) so it adapts to dark/light reskin.
    wp_enqueue_style(
        'gaip-bulk-area-modal-css',
        $plugin_url . '/assets/bulk-area-modal.css',
        array('gaip-hub-css'),
        gilba_asset_version( 'assets/bulk-area-modal.css' )
    );

    // Ammonium Acetate Methodology (Hill Labs NZ)
    // Adds NZ-specific Olsen P + NH₄OAc interpretation ranges
    wp_enqueue_script(
        'gaip-ammonium-acetate',
        $plugin_url . '/assets/ammonium-acetate-methodology.js',
        array('gaip-mlsn-progressive', 'gaip-regional-profiles'),
        gilba_asset_version( 'assets/ammonium-acetate-methodology.js' ),
        true
    );

    // Cotula bowling green — NZ only. Hill Labs S78 ranges, empirical N program.
    // Must load after gaip-ammonium-acetate (uses isNewZealand() from that module).
    wp_enqueue_script(
        'gaip-cotula-bowling',
        $plugin_url . '/assets/cotula-bowling-green.js',
        array('gaip-ammonium-acetate', 'gaip-regional-profiles'),
        gilba_asset_version( 'assets/cotula-bowling-green.js' ),
        true
    );

    // Nutrient Demand Engine (N-linked demand, Kussow et al. methodology)
    // b35fix301a: de-minified, reads MLSN from gaip-classification-constants.
    wp_enqueue_script(
        'gaip-nutrient-demand',
        $plugin_url . '/assets/nutrient-demand-engine.js',
        array('gaip-classification-constants', 'gaip-hub-js'),
        gilba_asset_version( 'assets/nutrient-demand-engine.js' ),
        true
    );

    // Nutrition Summary Integration (MLSN deficits + GP-weighted N distribution)
    // v1.1.4: SpeciesController integration for consistent species identity
    // b35fix301a: MLSN sourced from gaip-classification-constants (S=7 correction).
    // b35fix302b: depends on gilba-nutrition-requirement-engine; Task 9 rewire
    //             will move calculation logic into the engine.
    wp_enqueue_script(
        'gaip-nutrition-summary',
        $plugin_url . '/assets/nutrition-summary-integration.js',
        array('gaip-classification-constants', 'gaip-mlsn-progressive', 'gaip-nutrient-demand', 'gaip-species-controller', 'gilba-nutrition-requirement-engine'),
        gilba_asset_version( 'assets/nutrition-summary-integration.js' ),
        true
    );

    // Water Progressive Disclosure
    wp_enqueue_script(
        'gaip-water-progressive',
        $plugin_url . '/assets/water-progressive-disclosure-WITH-SOIL-INTERACTION.js',
        array('gaip-hub-js'),
        gilba_asset_version( 'assets/water-progressive-disclosure-WITH-SOIL-INTERACTION.js' ),
        true
    );

    // ========================================
    // SALINITY GROWTH PENALTY v1.0
    // Maas-Hoffman yield reduction model
    // Source: FAO, Harivandi, Carrow & Duncan
    // ========================================
    wp_enqueue_script(
        'gaip-salinity-penalty',
        $plugin_url . '/assets/salinity-penalty.js',
        array('gaip-water-progressive'),
        gilba_asset_version( 'assets/salinity-penalty.js' ),
        true
    );

    // ========================================
    // SALINITY CLIMATE INTEGRATION v1.0
    // Temperature-dependent thresholds, compound stress, ET concentration
    // Source: Carrow & Duncan (1998), Marcum (2006), Mittler (2006)
    // ========================================
    wp_enqueue_script(
        'gaip-salinity-climate',
        $plugin_url . '/assets/salinity-climate-integration.js',
        array('gaip-salinity-penalty', 'gaip-climate-v2'),
        gilba_asset_version( 'assets/salinity-climate-integration.js' ),
        true
    );

    // ========================================
    // SALINITY ENGINE (Pure) v2.0.0
    // Combines Maas-Hoffman + climate interaction into single pure function.
    // No window/DOM reads — all state passed via orchestrator.
    // Replaces salinity-penalty.js + salinity-climate-integration.js
    // when called through hub-orchestrator v1.9.0+.
    // Legacy files kept as fallback during validation.
    // Source: Maas & Hoffman (1977), Carrow & Duncan (1998),
    //         Marcum (2006), Mittler (2006), Munns & Tester (2008)
    // ========================================
    wp_enqueue_script(
        'gaip-salinity-engine-pure',
        $plugin_url . '/assets/salinity-engine-pure.js',
        array('gaip-climate-engine'),
        gilba_asset_version( 'assets/salinity-engine-pure.js' ),
        true
    );

    // ========================================
    // RECYCLED WATER NUTRIENT ENGINE v1.0
    // Salt-driven nutrient interaction advisory layer.
    // Activated by recycledWater toggle in water card.
    // Sources: Ayers & Westcot 1985 FAO 29; Marschner 2012;
    //          Grattan & Grieve 1999; Carrow & Duncan 1998.
    // ========================================
    wp_enqueue_script(
        'gaip-recycled-water-nutrient-engine',
        $plugin_url . '/assets/recycled-water-nutrient-engine.js',
        array('gaip-salinity-engine-pure'),
        gilba_asset_version( 'assets/recycled-water-nutrient-engine.js' ),
        true
    );

    // ========================================
    // PHYTOTOXICITY ENGINE v1.0
    // Direct foliar & root damage from Na, Cl, B
    // Source: Ayers & Westcot 1985, Carrow & Duncan 1998
    // ========================================
    wp_enqueue_script(
        'gaip-phytotoxicity',
        $plugin_url . '/assets/phytotoxicity-engine.js',
        array('gaip-water-progressive', 'gaip-variety-traits'),
        gilba_asset_version( 'assets/phytotoxicity-engine.js' ),
        true
    );

    // ========================================
    // WATER BLENDER MODULE v1.0
    // Multi-source water blending with full chemistry analysis
    // Source: Ayers & Westcot 1985, PACE Turf, Carrow & Duncan 1998
    // ========================================
    wp_enqueue_script(
        'gaip-water-blender',
        $plugin_url . '/assets/water-blender.js',
        array('gaip-utils', 'gaip-water-progressive'),
        gilba_asset_version( 'assets/water-blender.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-water-blender-ui',
        $plugin_url . '/assets/water-blender-ui.js',
        array('jquery', 'gaip-water-blender', 'gaip-water-progressive'),
        gilba_asset_version( 'assets/water-blender-ui.js' ),
        true
    );

    // ========================================
    // WATER REPORT IMPORTER v1.0.0
    // Parses Gilba water calculator PDF format
    // ========================================
    wp_enqueue_script(
        'gaip-water-importer',
        $plugin_url . '/assets/water-importer.js',
        array('gaip-water-blender-ui', 'gaip-sample-manager'),
        gilba_asset_version( 'assets/water-importer.js' ),
        true
    );

    // ========================================
    // AU VARIETY TRAITS v1.0.1
    // Fixed: global.VARIETY_TRAITS -> global.GAIP_VARIETY_TRAITS
    // ========================================
    wp_enqueue_script(
        'gaip-au-variety-traits',
        $plugin_url . '/assets/au-variety-traits.js',
        array('gaip-variety-traits'),
        gilba_asset_version( 'assets/au-variety-traits.js' ),
        true
    );

    // ========================================
    // NZ VARIETY TRAITS v1.0.1
    // Fixed: global.VARIETY_TRAITS -> global.GAIP_VARIETY_TRAITS
    // ========================================
    wp_enqueue_script(
        'gaip-nz-variety-traits',
        $plugin_url . '/assets/nz-variety-traits.js',
        array('gaip-variety-traits'),
        gilba_asset_version( 'assets/nz-variety-traits.js' ),
        true
    );
    wp_script_add_data('gaip-au-variety-traits', 'exclude-from-minification', true);
    wp_script_add_data('gaip-nz-variety-traits', 'exclude-from-minification', true);

    // ========================================
    // VARIETY TRAITS INTEGRATION v1.7.14
    // AU/NZ region routing, GEVES break fix, all regional databases
    // ========================================
    wp_enqueue_script(
        'gaip-variety-integration',
        $plugin_url . '/assets/variety-traits-integration.js',
        array('gaip-variety-traits', 'gaip-uk-variety-traits', 'gaip-scanturf-variety-traits', 'gaip-geves-variety-traits', 'gaip-bsa-variety-traits', 'gaip-japan-variety-traits', 'gaip-scandinavia-variety-traits', 'gaip-nz-fine-fescue-traits', 'gaip-regional-profiles', 'gaip-au-variety-traits', 'gaip-nz-variety-traits'),
        gilba_asset_version( 'assets/variety-traits-integration.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-variety-selector-ui',
        $plugin_url . '/assets/variety-selector-ui.js',
        array('gaip-variety-integration'),
        gilba_asset_version( 'assets/variety-selector-ui.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-cultivar-profile-ui',
        $plugin_url . '/assets/cultivar-profile-ui.js',
        array('gaip-variety-integration'),
        gilba_asset_version( 'assets/cultivar-profile-ui.js' ),
        true
    );

    // ========================================
    // NZ FINE FESCUE INTEGRATION v1.0.0
    // Wires NZ fine fescue traits into Hub systems
    // Must load AFTER variety-traits-integration.js and turf-profile-controller.js
    // ========================================
    wp_enqueue_script(
        'gaip-nz-fine-fescue-integration',
        $plugin_url . '/assets/nz-fine-fescue-integration.js',
        array('gaip-variety-integration', 'gaip-turf-profile-controller', 'gaip-nz-fine-fescue-traits'),
        gilba_asset_version( 'assets/nz-fine-fescue-integration.js' ),
        true
    );

    // ========================================
    // PGR MODULE v3.0
    // Species-specific GDD bases per Kreuser/Reasor:
    // - C3 grasses: Base 0°C (Kreuser & Soldat 2011)
    // - C4 grasses: Base 10°C (Reasor et al. 2018)
    // Validated sinewave models for HIGH confidence species
    // Added Prohexadione-Ca (Anuew)
    // v3.4.0: Turf profile surface detection fix
    // ========================================
    wp_enqueue_script(
        'gaip-pgr-module',
        $plugin_url . '/assets/gilba-pgr-module-v3.js',
        array('gaip-climate-engine', 'gaip-shade-engine'),
        gilba_asset_version( 'assets/gilba-pgr-module-v3.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-pgr-ui',
        $plugin_url . '/assets/pgr-ui.js',
        array('gaip-pgr-module'),
        gilba_asset_version( 'assets/pgr-ui.js' ),
        true
    );

    // ========================================
    // DMI GROWTH SUPPRESSION v1.0
    // Models PGR-like effects of DMI fungicides
    // Integrates with PGR program for combined suppression warnings
    // ========================================
    wp_enqueue_script(
        'gaip-dmi-suppression',
        $plugin_url . '/assets/dmi-growth-suppression.js',
        array('gaip-pgr-module'),
        gilba_asset_version( 'assets/dmi-growth-suppression.js' ),
        true
    );

    // ========================================
    // IRRIGATION SCHEDULER v1.1
    // FAO-56 ET, variety Kc modifiers, SMD tracking, OM effects
    // v1.3.3: Returns waterBalance even when forecast unavailable
    // ========================================
    wp_enqueue_script(
        'gaip-irrigation-scheduler',
        $plugin_url . '/assets/irrigation-scheduler.js',
        array('gaip-utils', 'gaip-climate-engine', 'gaip-variety-integration'),
        gilba_asset_version( 'assets/irrigation-scheduler.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-irrigation-ui',
        $plugin_url . '/assets/irrigation-scheduler-ui.js',
        array('gaip-irrigation-scheduler'),
        gilba_asset_version( 'assets/irrigation-scheduler-ui.js' ),
        true
    );

    // ========================================
    // CLIMATE MODULE v2.0
    // Variety-aware: winterkill, heat stress, dormancy
    // ========================================
    wp_enqueue_script(
        'gaip-climate-v2',
        $plugin_url . '/assets/climate-module-v2.js',
        array('gaip-climate-engine', 'gaip-variety-integration'),
        gilba_asset_version( 'assets/climate-module-v2.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-climate-v2-ui',
        $plugin_url . '/assets/climate-module-v2-ui.js',
        array('gaip-climate-v2'),
        gilba_asset_version( 'assets/climate-module-v2-ui.js' ),
        true
    );

    // Basic fallback is built into hub-tissue-v3.js (renderBasicClimateInfo)

    // ========================================
    // CLIMATE MODULE v2.1 - DUAL METRICS
    // Current vs 8-Day Outlook using real forecast data
    // Adds trajectory indicators and stress outlook
    // v2.1.1: Respects effective species when overseed is dominant
    // ========================================
    wp_enqueue_script(
        'gaip-climate-v2-dual-metrics',
        $plugin_url . '/assets/climate-module-v2.1-dual-metrics.js',
        array('gaip-utils', 'gaip-climate-v2'),
        gilba_asset_version( 'assets/climate-module-v2.1-dual-metrics.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-climate-v2-dual-metrics-ui',
        $plugin_url . '/assets/climate-module-v2.1-ui.js',
        array('gaip-climate-v2-dual-metrics', 'gaip-climate-v2-ui'),
        gilba_asset_version( 'assets/climate-module-v2.1-ui.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-climate-v2-dual-integration',
        $plugin_url . '/assets/climate-module-v2.1-integration.js',
        array('gaip-climate-v2-dual-metrics-ui'),
        gilba_asset_version( 'assets/climate-module-v2.1-integration.js' ),
        true
    );

    // ========================================
    // DEW PREDICTION MODULE v1.0
    // Sports turf only: dew forecasting, match-day conditions
    // Feeds leaf wetness data to disease engine
    // ========================================
    wp_enqueue_script(
        'gaip-dew-prediction-engine',
        $plugin_url . '/assets/dew-prediction-engine.js',
        array('gaip-climate-engine'),
        gilba_asset_version( 'assets/dew-prediction-engine.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-dew-prediction-ui',
        $plugin_url . '/assets/dew-prediction-ui.js',
        array('gaip-dew-prediction-engine'),
        gilba_asset_version( 'assets/dew-prediction-ui.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-dew-prediction-integration',
        $plugin_url . '/assets/dew-prediction-integration.js',
        array('gaip-dew-prediction-engine', 'gaip-dew-prediction-ui', 'gaip-hub-js'),
        gilba_asset_version( 'assets/dew-prediction-integration.js' ),
        true
    );

    wp_enqueue_style(
        'gaip-water-progressive-css',
        $plugin_url . '/assets/water-progressive-disclosure.css',
        array('gaip-hub-css'),
        gilba_asset_version( 'assets/water-progressive-disclosure.css' )
    );

    wp_enqueue_style(
        'gaip-water-blender-css',
        $plugin_url . '/assets/water-blender.css',
        array('gaip-water-progressive-css'),
        gilba_asset_version( 'assets/water-blender.css' )
    );

    // Tissue Progressive Disclosure
    wp_enqueue_script(
        'gaip-tissue-progressive',
        $plugin_url . '/assets/tissue-progressive-disclosure.js',
        array('gaip-hub-js'),
        gilba_asset_version( 'assets/tissue-progressive-disclosure.js' ),
        true
    );

    wp_enqueue_style(
        'gaip-tissue-progressive-css',
        $plugin_url . '/assets/mlsn-progressive-disclosure.css',  // Reuse MLSN styles
        array('gaip-hub-css'),
        gilba_asset_version( 'assets/mlsn-progressive-disclosure.css' )
    );

    // ========================================
    // EXTENDED REGIONAL FUNGICIDES v1.0.0
    // Nordic countries (SE, DK, NO) + Japan expanded databases
    // Must load BEFORE disease-engine.js
    // ========================================
    wp_enqueue_script(
        'gaip-extended-regional-fungicides',
        $plugin_url . '/assets/extended-regional-fungicides.js',
        array(),
        gilba_asset_version( 'assets/extended-regional-fungicides.js' ),
        true
    );

    // ========================================
    // EUROPEAN REGIONAL FUNGICIDES v1.0.0
    // France (ANSES), Spain (MAPA), Germany (BVL §17)
    // Must load BEFORE disease-engine.js
    // ========================================
    wp_enqueue_script(
        'gaip-european-regional-fungicides',
        $plugin_url . '/assets/european-regional-fungicides.js',
        array(),
        gilba_asset_version( 'assets/european-regional-fungicides.js' ),
        true
    );

    // ========================================
    // NZ FUNGICIDE DATABASE v1.0.0
    // ACVM/MPI registered active ingredients for New Zealand turf
    // Includes NZSTI bowls guide rates, FRAC groups, disease targets
    // Must load BEFORE fungicide-filter.js
    // ========================================
    wp_enqueue_script(
        'gaip-nz-fungicides',
        $plugin_url . '/assets/nz-fungicides.js',
        array(),
        gilba_asset_version( 'assets/nz-fungicides.js' ),
        true
    );

    // ========================================
    // AU FUNGICIDE DATABASE v1.0.0
    // APVMA-registered products for Australian turf.
    // Validated weekly against APVMA PubCRIS open dataset (data.gov.au).
    // No API key required. Must load BEFORE fungicide-filter.js.
    // ========================================
    wp_enqueue_script(
        'gaip-au-fungicides',
        $plugin_url . '/assets/au-fungicides.js',
        array(),
        gilba_asset_version( 'assets/au-fungicides.js' ),
        true
    );

    // ========================================
    // UK FUNGICIDE DATABASE v1.0.0
    // Source: HSE CRD MAPP register, BCPC UKPG 2024/2025,
    // Syngenta UK, BASF UK, Envu UK, Agrovista Amenity.
    // No API key required. Must load BEFORE fungicide-filter.js.
    // ========================================
    wp_enqueue_script(
        'gaip-uk-fungicides',
        $plugin_url . '/assets/uk-fungicides.js',
        array(),
        gilba_asset_version( 'assets/uk-fungicides.js' ),
        true
    );

    // ========================================
    // UNIFIED FUNGICIDE FILTER SERVICE v1.0.0
    // Routes fungicide queries to correct regional database
    // Separates AU (APVMA) from NZ (ACVM) based on coordinates
    // Must load AFTER all regional fungicide databases
    // ========================================
    wp_enqueue_script(
        'gaip-fungicide-filter',
        $plugin_url . '/assets/fungicide-filter.js',
        array('gaip-regional-profiles', 'gaip-nz-fungicides', 'gaip-au-fungicides', 'gaip-uk-fungicides', 'gaip-extended-regional-fungicides', 'gaip-european-regional-fungicides'),
        gilba_asset_version( 'assets/fungicide-filter.js' ),
        true
    );

    // ========================================
    // SMITH-KERNS DOLLAR SPOT MODEL v1.0.0
    // True implementation of Smith et al. (2018) PLOS ONE
    // 5-day rolling hourly RH/temp with 20% action threshold
    // Must load BEFORE disease-engine.js (provides DollarSpotModelV2)
    // ========================================
    wp_enqueue_script(
        'gaip-smith-kerns',
        $plugin_url . '/assets/smith-kerns-model.js',
        array('gaip-climate-engine'),
        gilba_asset_version( 'assets/smith-kerns-model.js' ),
        true
    );

    // ========================================
    // LARGE PATCH MODEL v1.0.0
    // Rhizoctonia solani AG 2-2 LP - warm-season (C4) turf only
    // Must load BEFORE disease-engine.js (provides LargePatchModel)
    // ========================================
    wp_enqueue_script(
        'gaip-large-patch',
        $plugin_url . '/assets/large-patch-model.js',
        array('gaip-climate-engine'),
        gilba_asset_version( 'assets/large-patch-model.js' ),
        true
    );

    // ========================================
    // DISEASE RISK ENGINE v2.10.0
    // Climate-driven disease prediction with REGIONAL PRESSURE MULTIPLIERS
    // Source: Smith-Kerns, Fidanza, Vargas, Smiley
    // v2.9.5: Added Waitea Patch model (NZ only), hemisphere-aware soil temp estimation
    // v2.10.0: Added Large Patch model for warm-season turf
    // ========================================
    wp_enqueue_script(
        'gaip-disease-engine',
        $plugin_url . '/assets/disease-engine.js',
        array('gaip-climate-engine', 'gaip-nitrogen-validator', 'gaip-regional-profiles', 'gaip-extended-regional-fungicides', 'gaip-european-regional-fungicides', 'gaip-fungicide-filter', 'gaip-smith-kerns', 'gaip-large-patch'),
        gilba_asset_version( 'assets/disease-engine.js' ),
        true
    );

    // ========================================
    // DISEASE ENGINE PURE v1.0.0
    // Pure-function extraction of disease calculations.
    // No DOM reads, no global mutations. All dependencies injected.
    // Loaded alongside legacy engine during migration (feature-flagged).
    // ========================================
    wp_enqueue_script(
        'gaip-disease-engine-pure',
        $plugin_url . '/assets/disease-engine-pure.js',
        array('gaip-disease-engine'),
        gilba_asset_version( 'assets/disease-engine-pure.js' ),
        true
    );

    // ========================================
    // DISEASE ↔ STRESS/CLIMATE COUPLING v1.0.0
    // Reduces false positives by factoring stress state and climate context
    // into disease risk calculations. Post-processes DiseaseEngine output.
    // Must load after disease-engine, consumed by hub-orchestrator.
    // ========================================
    wp_enqueue_script(
        'gaip-disease-stress-coupling',
        $plugin_url . '/assets/disease-stress-climate-coupling.js',
        array('gaip-disease-engine'),
        gilba_asset_version( 'assets/disease-stress-climate-coupling.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-disease-ui',
        $plugin_url . '/assets/disease-ui.js',
        array('gaip-disease-engine'),
        gilba_asset_version( 'assets/disease-ui.js' ),
        true
    );

    wp_enqueue_style(
        'gaip-disease-ui-css',
        $plugin_url . '/assets/disease-ui.css',
        array('gaip-hub-css'),
        gilba_asset_version( 'assets/disease-ui.css' )
    );

    wp_enqueue_script(
        'gaip-disease-integration',
        $plugin_url . '/assets/disease-integration.js',
        array('gaip-disease-engine', 'gaip-disease-engine-pure', 'gaip-disease-ui', 'gaip-hub-js', 'gaip-fungicide-filter'),
        gilba_asset_version( 'assets/disease-integration.js' ),
        true
    );

    // ========================================
    // LEAF SPOT MODELS v2.1 (BETA)
    // Species-specific disease models replacing generic Helminthosporium
    // Warm-season: B. cynodontis, B. sorokiniana, Curvularia spp.
    // Cool-season: Drechslera poae (KBG melting-out)
    // NEW: Co-infection synergy (B. sorokiniana + Curvularia)
    // Source: Brecht et al. 2007, PSU Turfgrass Lab, UMass Extension
    // ========================================
    wp_enqueue_script(
        'gaip-bipolaris-curvularia',
        $plugin_url . '/assets/bipolaris-curvularia-models.js',
        array('gaip-disease-engine', 'gaip-disease-integration'),
        gilba_asset_version( 'assets/bipolaris-curvularia-models.js' ),
        true
    );

    // ========================================
    // RED THREAD MODEL v1.0.0
    // Heuristic risk index for Laetisaria fuciformis
    // Valid globally for cool-season turf (UK, Europe, NZ, Australia, North America)
    // NOT a validated predictive model - uses observational thresholds
    // Key insight: Nitrogen deficiency is the primary driver
    // Source: Penn State, NC State, MSU, Syngenta ANZ, RHS UK, Smiley et al.
    // ========================================
    wp_enqueue_script(
        'gaip-red-thread-model',
        $plugin_url . '/assets/red-thread-model.js',
        array('gaip-disease-engine'),
        gilba_asset_version( 'assets/red-thread-model.js' ),
        true
    );

    // Red Thread Integration - wires model into disease forecast and UI
    wp_enqueue_script(
        'gaip-red-thread-integration',
        $plugin_url . '/assets/red-thread-integration.js',
        array('gaip-red-thread-model', 'gaip-disease-integration'),
        gilba_asset_version( 'assets/red-thread-integration.js' ),
        true
    );

    // ========================================
    // CHARTS MODULE v1.0
    // Shared SVG chart primitives for timeline visualizations
    // ========================================
    wp_enqueue_script(
        'gaip-charts',
        $plugin_url . '/assets/gilba-charts.js',
        array(),
        gilba_asset_version( 'assets/gilba-charts.js' ),
        true
    );

    // ========================================
    // DISEASE FORECAST v1.3
    // Daily disease risk forecast for timeline chart
    // v1.3: Consecutive day multiplier + soil temp estimate
    // v1.4: Respects effective species when overseed is dominant
    // v1.4.1: Fix stale species after switching turf types
    // v2.0: GAIP physics-based soil temp integration
    // v2.1: Red thread model integration for UK/Europe/NZ/AU
    // ========================================
    wp_enqueue_script(
        'gaip-disease-forecast',
        $plugin_url . '/assets/disease-forecast.js',
        array('gaip-charts', 'gaip-disease-engine', 'gaip-disease-engine-pure', 'gaip-red-thread-integration', 'gaip-species-controller'),
        gilba_asset_version( 'assets/disease-forecast.js' ),
        true
    );

    // ========================================
    // IRRIGATION FORECAST v1.0
    // Water balance timeline chart
    // ========================================
    wp_enqueue_script(
        'gaip-irrigation-forecast',
        $plugin_url . '/assets/irrigation-forecast.js',
        array('gaip-charts', 'gaip-irrigation-scheduler'),
        gilba_asset_version( 'assets/irrigation-forecast.js' ),
        true
    );
    // ========================================

    // ========================================
    // SHADE FORECAST v1.0.0
    // Seasonal DLI trajectory chart
    // ========================================
    wp_enqueue_script(
        'gaip-shade-forecast',
        $plugin_url . '/assets/shade-forecast.js',
        array('gaip-charts', 'gaip-shade-engine'),
        gilba_asset_version( 'assets/shade-forecast.js' ),
        true
    );

    // ========================================
    // PGR FORECAST v1.0.1
    // GDD decay timeline chart
    // ========================================
    wp_enqueue_script(
        'gaip-pgr-forecast',
        $plugin_url . '/assets/pgr-forecast.js',
        array('gaip-charts', 'gaip-pgr-module'),
        gilba_asset_version( 'assets/pgr-forecast.js' ),
        true
    );

    // ========================================
    // STRESS TRAJECTORY ENGINE v2.0.0
    // True time-series stress projection (14-day default, up to 28)
    // Integrates: Water | Light | Temperature | Nutrition | Traffic | Disease
    // Compound effects when multiple stressors > 35%
    // Source: Gilba Solutions methodology integrating:
    //   - Thermal: PACE Turf GP model (C3/C4 optimal ranges)
    //   - Light: Wherley et al. (2005), Trappe et al. (2011) - DLI recovery
    //   - Moisture: FAO-56 ET balance, Carrow & Duncan (1998)
    //   - Traffic: Baker/Gibbs STRI (1989), GMA UK
    //   - Nutrition: Kussow et al., PACE Turf N response
    //   - Biotic: Smith-Kerns, Fidanza, Vargas disease models
    // ========================================
    wp_enqueue_script(
        'gaip-stress-trajectory-engine',
        $plugin_url . '/assets/stress-trajectory-engine-pure.js',
        array('gaip-climate-engine', 'gaip-disease-engine', 'gaip-dli-recovery-bridge', 'gaip-wear-recovery-engine'),
        gilba_asset_version( 'assets/stress-trajectory-engine-pure.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-stress-trajectory-ui',
        $plugin_url . '/assets/stress-trajectory-ui.js',
        array('gaip-stress-trajectory-engine'),
        gilba_asset_version( 'assets/stress-trajectory-ui.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-stress-trajectory-integration',
        $plugin_url . '/assets/stress-trajectory-integration.js',
        array('gaip-stress-trajectory-engine', 'gaip-stress-trajectory-ui', 'gaip-hub-js'),
        gilba_asset_version( 'assets/stress-trajectory-integration.js' ),
        true
    );

    // ========================================
    // HUB INTEGRATION PATCH v1.0.0
    // Wires DLI-Recovery Bridge and Stress Trajectory into hub pipeline
    // - Enhances shadeData with DLI recovery modifiers before wear-recovery
    // - Adds stress trajectory projection after all modules complete
    // - Provides rendering helpers for UI integration
    // ========================================
    wp_enqueue_script(
        'gaip-hub-integration-patch',
        $plugin_url . '/assets/hub-integration-patch.js',
        array('gaip-dli-recovery-bridge', 'gaip-stress-trajectory-engine', 'gaip-wear-recovery-engine', 'gaip-hub-js'),
        gilba_asset_version( 'assets/hub-integration-patch.js' ),
        true
    );

    // ========================================
    // DEPENDENCY GRAPH v1.0.0
    // Must load BEFORE hub-orchestrator and scenario engine
    // Formalizes engine dependencies as a DAG for selective recomputation
    // ========================================
    wp_enqueue_script(
        'gaip-dependency-graph',
        $plugin_url . '/assets/dependency-graph.js',
        array(),  // No dependencies - standalone graph definition
        gilba_asset_version( 'assets/dependency-graph.js' ),
        true
    );

    // ========================================
    // HUB ORCHESTRATOR v1.0.0
    // Central module wiring and dependency resolution
    // Enforces causality between engine outputs:
    // - Salinity → recovery penalty
    // - Shade → recovery + disease
    // - Dew duration → disease risk
    // ========================================
    // SOIL TEMPERATURE LOGGER v1.0.0
    // Stores daily soil temp readings per site in localStorage.
    // Feeds GAIP_SoilTempLogger.getHistory() into buildPreEmergentInputs()
    // so the trend engine has real measured data instead of synthesised estimates.
    // Fires on gaip:orchestrator-complete — one entry per site per day.
    // ========================================
    wp_enqueue_script(
        'gaip-soil-temp-logger',
        $plugin_url . '/assets/soil-temp-logger.js',
        array('gaip-hub-js'),
        gilba_asset_version( 'assets/soil-temp-logger.js' ),
        true
    );

    // ========================================
    // PRE-EMERGENT TIMING ENGINE v1.0.0
    // Pure function engine — soil temp thresholds vs germination data.
    // - 12 weed species (AU/NZ priority list)
    // - GREEN / AMBER / RED_EARLY / RED_MISSED alert logic
    // - Poa annua declining-temperature trigger (reversed logic)
    // - Confidence-rated thresholds (H/M/L) from peer-reviewed literature
    // - Must load BEFORE hub-orchestrator (consumed in computeAll step 8b)
    // Sources: Fidanza et al. (1996); Taylor et al. (2021); Teuton et al. (2004)
    // ========================================
    wp_enqueue_script(
        'gaip-pre-emergent-engine',
        $plugin_url . '/assets/pre-emergent-engine.js',
        array('gaip-climate-engine'),
        gilba_asset_version( 'assets/pre-emergent-engine.js' ),
        true
    );

    // ========================================
    // PRE-EMERGENT INTEGRATION & UI v1.0.0
    // Renders timing card from GAIP_PRE_EMERGENT_RESULT after orchestrator runs.
    // Depends on pre-emergent-engine and hub-orchestrator.
    // ========================================
    wp_enqueue_script(
        'gaip-pre-emergent-integration',
        $plugin_url . '/assets/pre-emergent-integration.js',
        array('gaip-pre-emergent-engine', 'gaip-hub-orchestrator'),
        gilba_asset_version( 'assets/pre-emergent-integration.js' ),
        true
    );

    // - Stress aggregation → compound effects
    // v1.5.0: Tiered identity enforcement - hard fail species, soft default others
    // ========================================
    wp_enqueue_script(
        'gaip-hub-orchestrator',
        $plugin_url . '/assets/hub-orchestrator.js',
        array(
            'gaip-utils',
            'gaip-species-controller',
            'gaip-identity-enforcement',  // v1.5.0: Must load before orchestrator
            'gaip-climate-engine',
            'gaip-shade-engine',
            'gaip-salinity-penalty',
            'gaip-salinity-engine-pure',  // v1.9.0: Pure salinity engine (fallback to legacy above)
            'gaip-wear-recovery-engine',
            'gaip-dew-prediction-engine',
            'gaip-disease-engine',
            'gaip-pre-emergent-engine',   // v1.0.0: Pre-emergent timing engine (step 8b)
            'gaip-soil-temp-logger',          // v1.0.0: Stored soil temp history for trend analysis
            'gaip-hub-js',
            'gaip-dependency-graph'
        ),
        gilba_asset_version( 'assets/hub-orchestrator.js' ),
        true
    );

    // ========================================
    // PHASE 1 EPISTEMIC INFRASTRUCTURE
    // Citation registry, contradiction detection, export metadata
    // ========================================
    
    // Citation Registry v1.0.0
    // Provides formal provenance tracking for all engine outputs
    wp_enqueue_script(
        'gaip-citation-registry',
        $plugin_url . '/assets/citation-registry.js',
        array('gaip-hub-orchestrator'),
        gilba_asset_version( 'assets/citation-registry.js' ),
        true
    );
    
    // Engine Confidence v2.0.0
    // Standardizes applicability and confidence assessment across all engines
    // v2.0: Input completeness, confidence accumulation, forecast degradation
    wp_enqueue_script(
        'gaip-engine-confidence',
        $plugin_url . '/assets/engine-confidence.js',
        array('gaip-hub-orchestrator', 'gaip-citation-registry'),
        gilba_asset_version( 'assets/engine-confidence.js' ),
        true
    );
    
    // Confidence UI Integration v1.0.1
    // Displays confidence badges and warnings in the Hub UI
    // v1.0.1: Fixed TypeError when warnings array is undefined
    wp_enqueue_script(
        'gaip-confidence-ui',
        $plugin_url . '/assets/confidence-ui-integration.js',
        array('gaip-engine-confidence', 'gaip-hub-orchestrator'),
        gilba_asset_version( 'assets/confidence-ui-integration.js' ),
        true
    );
    
    // Contradiction Detector v1.0.0
    // Meta-engine oversight for internal consistency checks
    wp_enqueue_script(
        'gaip-contradiction-detector',
        $plugin_url . '/assets/contradiction-detector.js',
        array('gaip-hub-orchestrator', 'gaip-citation-registry'),
        gilba_asset_version( 'assets/contradiction-detector.js' ),
        true
    );
    
    // Input Range Validator v1.0.0
    // Validates soil/water/tissue values against expected agronomic ranges
    // Advisory warnings only - catches garbage-in scenarios
    wp_enqueue_script(
        'gaip-input-validator',
        $plugin_url . '/assets/input-range-validator.js',
        array('gaip-hub-js'),
        gilba_asset_version( 'assets/input-range-validator.js' ),
        true
    );
    
      // ========================================
    // SCENARIO ENGINE + COMPARISON UI (Phase 2)
    // ========================================
    
    // Scenario Engine v2.0.3
    // Pure state-based calculations - bypasses DOM-reading global engines
    // Integrated: Water, Disease, Shade, Traffic, PGR, Irrigation, N-Opt, Stress
    wp_enqueue_script(
        'gaip-scenario-engine',
        $plugin_url . '/assets/gaip-scenario-engine.js',
        array('gaip-hub-orchestrator', 'gaip-engine-confidence', 'gaip-dependency-graph'),
        gilba_asset_version( 'assets/gaip-scenario-engine.js' ),
        true
    );
    
    // Scenario Comparison UI v2.6.2
    // Word Export Integration - wires up GilbaScenarioExport.prepare()
    // Species comparison presets: Kikuyu, Couch, Ryegrass, Zoysia, Buffalo
    // Displays all engine results with delta comparison
    wp_enqueue_script(
        'gaip-scenario-ui',
        $plugin_url . '/assets/gaip-whatif-ui.js',
        array('gaip-scenario-engine', 'gaip-engine-confidence', 'gaip-dependency-graph'),
        gilba_asset_version( 'assets/gaip-whatif-ui.js' ),
        true
    );

    // ========================================
    // CASCADE ORCHESTRATOR + SCENARIO PRESETS (Stage 2-4)
    // Dependency-aware engine execution and preset scenarios
    // ========================================
    
    // Cascade Orchestrator v1.3.0 (SSOT Adapter)
    // Provides GilbaCascadeOrchestrator.runCascade() interface
    // v1.1.0: Added soil-structure-engine integration (Stage 2.5)
    // v1.2.0: Added stress-trajectory-engine (Stage 6)
    // v1.3.0: Added pre-emergent-engine (step 8b)
    // v1.3.0: Added phytotoxicity-engine (Stage 2.6)
    // Must load BEFORE hub-tissue-v3.js
    // Note: phytotoxicity-engine loads via water-progressive chain, not as direct dependency
    wp_enqueue_script(
        'gaip-cascade-orchestrator',
        $plugin_url . '/assets/cascade-orchestrator.js',
        array('gaip-dependency-graph'),
        gilba_asset_version( 'assets/cascade-orchestrator.js' ),
        true
    );
    
    // Prediction Logger v1.0.0 (Phase 1 of Empirical Calibration)
    // Passively observes cascade completions and logs predictions for outcome tracking
    // Subscribes to gaip:cascade-complete event, writes to wp_gilba_predictions
    wp_enqueue_script(
        'gaip-prediction-logger',
        $plugin_url . '/assets/prediction-logger.js',
        array('gaip-cascade-orchestrator'),
        gilba_asset_version( 'assets/prediction-logger.js' ),
        true
    );
    
    // Outcome Capture UI v1.0.0 (Phase 2 of Empirical Calibration)
    // Surfaces ripe predictions for superintendent review, writes outcomes via REST
    // Renders in Today tab above daily dashboard
    wp_enqueue_script(
        'gaip-outcome-capture-ui',
        $plugin_url . '/assets/outcome-capture-ui.js',
        array('gaip-prediction-logger', 'gaip-tab-navigation'),
        gilba_asset_version( 'assets/outcome-capture-ui.js' ),
        true
    );
    // Exclude from caching plugin minification (Autoptimize / WP Rocket / LiteSpeed)
    wp_script_add_data('gaip-outcome-capture-ui', 'exclude-from-minification', true);
    
    // Scenario Presets v1.0.0
    // Pre-configured what-if scenarios: Gypsum, MLSN/SLAN, Water Blending
    // b35fix301a: MLSN table sourced from gaip-classification-constants.
    wp_enqueue_script(
        'gaip-scenario-presets',
        $plugin_url . '/assets/scenario-presets.js',
        array('gaip-classification-constants', 'gaip-cascade-orchestrator'),
        gilba_asset_version( 'assets/scenario-presets.js' ),
        true
    );
    
    // Scenario Export v1.0.0
    // Formats scenario comparisons for Word export with confidence scoring
    wp_enqueue_script(
        'gaip-scenario-export',
        $plugin_url . '/assets/scenario-export.js',
        array('gaip-scenario-presets'),
        gilba_asset_version( 'assets/scenario-export.js' ),
        true
    );
    
    // Word Export Scenario Patch v1.2.0
    // Integrates scenario data into Word export
    // v1.2.0: Actually renders scenario section into document (patches buildSections)
    wp_enqueue_script(
        'gaip-word-export-patch',
        $plugin_url . '/assets/word-export-scenario-patch.js',
        array('gaip-word-export', 'gaip-scenario-export'),
        gilba_asset_version( 'assets/word-export-scenario-patch.js' ),
        true
    );

    // ========================================
    // SpecConnect API Adapter (TDR 350/300 live data)
    wp_enqueue_script(
        'gaip-specconnect',
        $plugin_url . '/assets/sensor-api-specconnect.js',
        array('gaip-hub-js', 'gaip-sensor-api-bridge'),
        gilba_asset_version( 'assets/sensor-api-specconnect.js' ),
        true
    );

    // SENSOR IMPORT MODULE (TDR 350 + POGO support)
    // ========================================
    wp_enqueue_style(
        'gaip-sensor-css',
        $plugin_url . '/assets/sensor-import.css',
        array(),
        gilba_asset_version( 'assets/sensor-import.css' )
    );
    
    wp_enqueue_script(
        'gaip-sensor-import',
        $plugin_url . '/assets/sensor-import.js',
        array(),
        gilba_asset_version( 'assets/sensor-import.js' ),
        true
    );
    wp_script_add_data('gaip-sensor-import', 'exclude-from-minification', true);
    
    wp_enqueue_script(
        'gaip-sensor-ui',
        $plugin_url . '/assets/sensor-import-ui.js',
        array('gaip-sensor-import'),
        gilba_asset_version( 'assets/sensor-import-ui.js' ),
        true
    );
    
    // ========================================
    // LIVE SENSOR API INTEGRATIONS
    // Multi-vendor sensor support with per-user credentials
    // and site-to-sensor mapping
    // ========================================
    
    // Sensor Integration Manager v1.0.0
    // Central coordinator for all sensor vendors
    // Handles credentials, site mapping, data aggregation
    wp_enqueue_script(
        'gaip-sensor-manager',
        $plugin_url . '/assets/sensor-integration-manager.js',
        array('gaip-sensor-import'),
        gilba_asset_version( 'assets/sensor-integration-manager.js' ),
        true
    );
    
    // Hydrosight Vendor Adapter v1.2.0
    // Registers with SensorManager, handles Hydrosight API
    wp_enqueue_script(
        'gaip-sensor-api-hydrosight',
        $plugin_url . '/assets/sensor-api-hydrosight.js',
        array('gaip-sensor-manager'),
        gilba_asset_version( 'assets/sensor-api-hydrosight.js' ),
        true
    );
    
    // Sensor API Bridge v1.0.0
    // Patches GAIP_Sensor for live data priority
    wp_enqueue_script(
        'gaip-sensor-api-bridge',
        $plugin_url . '/assets/sensor-api-bridge.js',
        array('gaip-sensor-manager', 'gaip-sensor-api-hydrosight'),
        gilba_asset_version( 'assets/sensor-api-bridge.js' ),
        true
    );
    
    // Sensor Integration UI v1.0.0
    // Settings panel, site-sensor mapping modal
    wp_enqueue_script(
        'gaip-sensor-settings-ui',
        $plugin_url . '/assets/sensor-integration-ui.js',
        array('gaip-sensor-manager', 'gaip-sensor-api-hydrosight'),
        gilba_asset_version( 'assets/sensor-integration-ui.js' ),
        true
    );
    
    // ========================================
    // LAB DATA IMPORT MODULE (CSV)
    // ========================================
    // Lab Import v1.1.0 - Schema validation
    // Validates CSV headers and value ranges at import time
    // ========================================
    wp_enqueue_script(
        'gaip-lab-import',
        $plugin_url . '/assets/lab-import.js',
        array(),
        gilba_asset_version( 'assets/lab-import.js' ),
        true
    );
    
    // ========================================
    // MULTI-SAMPLE MANAGER v1.0
    // Supports multiple soil, water, tissue samples
    // Import from CSV/XLSX or manual entry
    // ========================================
    wp_enqueue_script(
        'gaip-sample-manager',
        $plugin_url . '/assets/sample-manager.js',
        array('gaip-lab-import'),
        gilba_asset_version( 'assets/sample-manager.js' ),
        true
    );
    
    // v1.0.0: Sample persistence - auto-saves samples to localStorage
    // Listens for sample mutation events, restores on page load
    wp_enqueue_script(
        'gaip-sample-persistence',
        $plugin_url . '/assets/sample-persistence.js',
        array('gaip-sample-manager'),
        gilba_asset_version( 'assets/sample-persistence.js' ),
        true
    );
    
    // b35fix311_1: single-source zone-key derivation. Enqueued BEFORE
    // word-export-combined and nutrient-trend (both depend on it).
    wp_enqueue_script(
        'gaip-zone-key',
        $plugin_url . '/assets/zone-key.js',
        array(),
        gilba_asset_version( 'assets/zone-key.js' ),
        true
    );

    // v1.0.0: Combined multi-site Word export (one document for all samples)
    // b35fix302b: depends on gilba-nutrition-requirement-engine (Task 11 rewire
    //             retires computeANRFromSoil in favour of per-sample engine calls).
    wp_enqueue_script(
        'gaip-word-export-combined',
        $plugin_url . '/assets/word-export-combined.js',
        array('gaip-word-export', 'gaip-sample-manager', 'gilba-nutrition-requirement-engine', 'gaip-zone-key'),
        gilba_asset_version( 'assets/word-export-combined.js' ),
        true
    );

    // iCal export — spray log (90 days) + PGR reminder + pre-emergent timing alerts
    wp_enqueue_script(
        'gaip-ical-export',
        $plugin_url . '/assets/gaip-ical-export.js',
        array('gaip-word-export-combined', 'gaip-sample-manager'),
        gilba_asset_version( 'assets/gaip-ical-export.js' ),
        true
    );
    
    wp_enqueue_script(
        'gaip-sample-switcher-ui',
        $plugin_url . '/assets/sample-switcher-ui.js',
        array('gaip-sample-manager'),
        gilba_asset_version( 'assets/sample-switcher-ui.js' ),
        true
    );

    // b35fix311: bulk-area modal. Depends on SampleManager for data access and
    // loads after the switcher so the 📐 Set area… button wiring finds it.
    wp_enqueue_script(
        'gaip-bulk-area-modal',
        $plugin_url . '/assets/bulk-area-modal.js',
        array('gaip-sample-manager', 'gaip-sample-switcher-ui'),
        gilba_asset_version( 'assets/bulk-area-modal.js' ),
        true
    );

    // b35fix367: Per-sample turf profile modal. Surfaces only when multi-site
    // turf mode is on for the active site. Depends on TurfProfile for the
    // species-options helpers and SampleManager for the read/write API.
    wp_enqueue_script(
        'gaip-sample-turf-profile-modal',
        $plugin_url . '/assets/sample-turf-profile-modal.js',
        array('gaip-sample-manager', 'gaip-sample-switcher-ui'),
        gilba_asset_version( 'assets/sample-turf-profile-modal.js' ),
        true
    );

    // b35fix368: Bulk turf profile modal — set species + companion across many
    // samples at once. Mirrors the bulk-area pattern. Visibility-gated by the
    // multi-site turf toggle for the active site (handled in sample-switcher-ui).
    wp_enqueue_script(
        'gaip-sample-turf-profile-bulk-modal',
        $plugin_url . '/assets/sample-turf-profile-bulk-modal.js',
        array('gaip-sample-manager', 'gaip-sample-switcher-ui'),
        gilba_asset_version( 'assets/sample-turf-profile-bulk-modal.js' ),
        true
    );

    // b35fix367: Multi-site turf toggle injector. Adds the checkbox into the
    // site selector row at runtime (no PHP template change). Depends on the
    // sample switcher for the row to attach to and on site-config-persistence
    // for the toggle storage.
    wp_enqueue_script(
        'gaip-multi-site-turf-toggle',
        $plugin_url . '/assets/site-settings-multi-site-turf-toggle.js',
        array('gaip-sample-switcher-ui'),
        gilba_asset_version( 'assets/site-settings-multi-site-turf-toggle.js' ),
        true
    );

    // Form UX v1.0 - collapsible sections for redesigned soil/water cards
    wp_enqueue_script(
        'gaip-form-ux',
        $plugin_url . '/assets/form-ux.js',
        array(),
        gilba_asset_version( 'assets/form-ux.js' ),
        true
    );
    
    // ========================================
    // LAB REPORT PARSER v1.0.0
    // Upload PDF/DOCX lab reports for AI extraction
    // Populates soil, water, tissue via SampleManager
    // ========================================
    wp_enqueue_script(
        'gaip-lab-parser',
        $plugin_url . '/assets/lab-report-parser.js',
        array('gaip-sample-manager'),
        gilba_asset_version( 'assets/lab-report-parser.js' ),
        true
    );
    
    wp_localize_script(
        'gaip-lab-parser',
        'gaipLabParser',
        array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce'   => wp_create_nonce('gilba_hub_nonce')
        )
    );
    
    // Clear Data Module - clear/reset buttons for soil, water, tissue panels
    wp_enqueue_script(
        'gaip-clear-data',
        $plugin_url . '/assets/gaip-clear-data.js',
        array('gaip-sample-manager'),
        gilba_asset_version( 'assets/gaip-clear-data.js' ),
        true
    );
    
    // Input State Watcher - detects stale results after input changes
    // Part of TIER 2 #4: Scenario-Aware Recalculation Cascade
    wp_enqueue_script(
        'gaip-input-watcher',
        $plugin_url . '/assets/input-state-watcher.js',
        array('gaip-hub-js', 'gaip-sample-manager'),
        gilba_asset_version( 'assets/input-state-watcher.js' ),
        true
    );
    
    // Soil Structure Engine - Water → Soil Structure Assessment
    // Part of TIER 2 #6: Two-pathway model (clay/sand)
    // v2.0.2: Fixed species extraction (grassSpecies not variety)
    wp_enqueue_script(
        'gaip-soil-structure',
        $plugin_url . '/assets/soil-structure-engine.js',
        array('gaip-utils', 'gaip-species-controller', 'gaip-water-blender', 'gaip-salinity-penalty'),
        gilba_asset_version( 'assets/soil-structure-engine.js' ),
        true
    );
    
    wp_enqueue_style(
        'gaip-sample-manager-css',
        $plugin_url . '/assets/sample-manager.css',
        array('gaip-hub-css'),
        gilba_asset_version( 'assets/sample-manager.css' )
    );
    
    // Site Selector UI - multi-site management for consultants
    wp_enqueue_script(
        'gaip-site-selector-ui',
        $plugin_url . '/assets/site-selector-ui.js',
        array('gaip-sample-manager'),
        gilba_asset_version( 'assets/site-selector-ui.js' ),
        true
    );
    
    // Site Config Persistence - saves/restores turf profile per site on switch
    wp_enqueue_script(
        'gaip-site-config',
        $plugin_url . '/assets/site-config-persistence.js',
        array('gaip-sample-manager', 'gaip-site-selector-ui'),
        gilba_asset_version( 'assets/site-config-persistence.js' ),
        true
    );
    
    // Site ↔ Profile Bridge - syncs Site Selector saves into Saved Profiles dropdown
    wp_enqueue_script(
        'gaip-site-profile-bridge',
        $plugin_url . '/assets/site-profile-bridge.js',
        array('gaip-site-config', 'gaip-site-selector-ui', 'gaip-turf-profile-controller'),
        gilba_asset_version( 'assets/site-profile-bridge.js' ),
        true
    );
    
    // Site Switch Cleanup - clears stale module globals on site change
    wp_enqueue_script(
        'gaip-site-switch-cleanup',
        $plugin_url . '/assets/site-switch-cleanup.js',
        array('gaip-sample-manager', 'gaip-site-selector-ui'),
        gilba_asset_version( 'assets/site-switch-cleanup.js' ),
        true
    );
    
    wp_enqueue_style(
        'gaip-site-selector-css',
        $plugin_url . '/assets/site-selector-ui.css',
        array('gaip-hub-css'),
        gilba_asset_version( 'assets/site-selector-ui.css' )
    );
    
    // ========================================
    // SITE DASHBOARD v2.0.0
    // Unified site management — card grid with search, zone
    // breakdown tooltips, auto-save status, JSON export.
    // Sits above all hub content; reads from existing APIs.
    // ========================================
    wp_enqueue_script(
        'gaip-site-dashboard',
        $plugin_url . '/assets/site-dashboard.js',
        array('gaip-sample-manager', 'gaip-site-config'),
        gilba_asset_version( 'assets/site-dashboard.js' ),
        true
    );
    
    wp_enqueue_style(
        'gaip-site-dashboard-css',
        $plugin_url . '/assets/site-dashboard.css',
        array('gaip-hub-css'),
        gilba_asset_version( 'assets/site-dashboard.css' )
    );
    
    // ========================================
    // NUTRIENT TREND TRACKING v1.0
    // Temporal trend analysis per zone with MLSN threshold crossing alerts
    // ========================================
    // Note: gaip-zone-key is already enqueued earlier (shared dep with word-export-combined)
    wp_enqueue_script(
        'gaip-nutrient-trend',
        $plugin_url . '/assets/nutrient-trend.js',
        array('gaip-classification-constants', 'gaip-sample-manager', 'gaip-mlsn-progressive', 'gaip-nutrient-demand', 'gaip-zone-key'),
        gilba_asset_version( 'assets/nutrient-trend.js' ),
        true
    );
    
    wp_enqueue_style(
        'gaip-nutrient-trend-css',
        $plugin_url . '/assets/nutrient-trend.css',
        array('gaip-mlsn-progressive-css'),
        gilba_asset_version( 'assets/nutrient-trend.css' )
    );
    
    // ========================================
    // WORD EXPORT v2.0
    // Export to .docx format
    // ========================================
    
    // JSZip 3.10.1 — local copy (eliminates CDN dependency on cdnjs.cloudflare.com)
    wp_enqueue_script(
        'gaip-jszip',
        $plugin_url . '/assets/jszip.min.js',
        array(),
        '3.10.1',
        true
    );
    
    wp_enqueue_script(
        'gaip-docx-lib',
        $plugin_url . '/assets/docx.min.js',
        array('gaip-jszip'),
        gilba_asset_version( 'assets/docx.min.js' ),
        true
    );
    
    wp_enqueue_script(
        'gaip-word-export',
        $plugin_url . '/assets/word-export.js',
        array('gaip-docx-lib', 'gaip-hub-js', 'gaip-jszip', 'gaip-fungicide-filter', 'gaip-nutrient-trend', 'gilba-nutrition-requirement-engine'),
        gilba_asset_version( 'assets/word-export.js' ),
        true
    );

    // ========================================
    // CHART ANNOTATOR v1.0.0
    // Embedded modal annotation tool for hub charts.
    // Adds "Annotate" button to every .gaip-chart-header.
    // API: GilbaAnnotator.open(svgEl, title)
    //      GilbaAnnotator.openFromDataURL(dataURL, title, w, h)
    //      GilbaAnnotator.attachButtons()  — call after dynamic renders
    // ========================================
    wp_enqueue_script(
        'gaip-chart-annotator',
        $plugin_url . '/assets/chart-annotator-hub.js',
        array('gaip-word-export'),
        gilba_asset_version( 'assets/chart-annotator-hub.js' ),
        true
    );
    // Inline patch: fix attachButtons() to use .gaip-mso-header class lookup
    // instead of #gaip-mso-soil ID which is absent in the rendered DOM.
    wp_add_inline_script('gaip-chart-annotator', <<<'JSPATCH'
(function() {
    // Fix 1: Annotate buttons — use .gaip-mso-header class lookup (no #gaip-mso-soil ID in DOM)
    document.addEventListener('gaip:analysis-complete', function() {
        setTimeout(function() {
            if (typeof GilbaAnnotator === 'undefined') return;
            document.querySelectorAll('.gaip-mso-header').forEach(function(msoHeader) {
                if (msoHeader.querySelector('.gilba-annotate-btn')) return;
                var msoSoil = msoHeader.parentElement;
                var btn = document.createElement('button');
                btn.className = 'gilba-annotate-btn';
                btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg> Annotate';
                btn.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:5px;background:transparent;border:1px solid #9ca3af;color:#6b7280;font-size:11px;cursor:pointer;font-family:inherit;transition:all .12s;margin-left:8px;flex-shrink:0;float:right;';
                btn.addEventListener('mouseenter', function() { btn.style.borderColor='#059669'; btn.style.color='#059669'; });
                btn.addEventListener('mouseleave', function() { btn.style.borderColor='#9ca3af'; btn.style.color='#6b7280'; });
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var grid = msoSoil.querySelector('.gaip-mso-grid') || msoSoil;
                    GilbaAnnotator.openFromElement(grid, 'Soil Nutrition — All Sources');
                });
                msoHeader.appendChild(btn);
            });
        }, 400);
    });

})();
JSPATCH
    );

    // Export Metadata v1.0.0
    // Adds version stamps, citations, and provenance to exports
    wp_enqueue_script(
        'gaip-export-metadata',
        $plugin_url . '/assets/export-metadata.js',
        array('gaip-word-export', 'gaip-citation-registry', 'gaip-contradiction-detector'),
        gilba_asset_version( 'assets/export-metadata.js' ),
        true
    );
    
    // ========================================
    // AI INTERPRETATION v1.0.0
    // Claude-powered soil analysis interpretation
    // Supports MLSN, SLAN, Ammonium Acetate (Hill Labs NZ)
    // ========================================
    wp_enqueue_script(
        'gaip-soil-interpretation',
        $plugin_url . '/assets/gilba-soil-interpretation.js',
        array('gaip-hub-js', 'gaip-mlsn-progressive'),
        gilba_asset_version( 'assets/gilba-soil-interpretation.js' ),
        true
    );
    
    // Water Quality AI Interpretation
    wp_enqueue_script(
        'gaip-water-interpretation',
        $plugin_url . '/assets/gilba-water-interpretation.js',
        array('gaip-hub-js'),
        gilba_asset_version( 'assets/gilba-water-interpretation.js' ),
        true
    );
    
    // Cross-Module Synthesis Interpretation
    wp_enqueue_script(
        'gaip-synthesis-interpretation',
        $plugin_url . '/assets/gilba-synthesis-interpretation.js',
        array('gaip-hub-js'),
        gilba_asset_version( 'assets/gilba-synthesis-interpretation.js' ),
        true
    );
    
    wp_enqueue_style(
        'gaip-interpretation-css',
        $plugin_url . '/assets/gilba-interpretation.css',
        array('gaip-hub-css'),
        gilba_asset_version( 'assets/gilba-interpretation.css' )
    );
    // ========================================

    // ========================================
    // HUB PERSISTENCE v1.0.0
    // localStorage persistence for input state, samples, and preferences
    // Auto-saves on changes, restores on page load
    // ========================================
    wp_enqueue_script(
        'gaip-hub-persistence',
        $plugin_url . '/assets/hub-persistence.js',
        // b35fix273: gaip-site-config must load before hub-persistence so
        // GAIP_SITE_CONFIG_PENDING=true is set before restoreSamples fires computeAll.
        array('gaip-hub-js', 'gaip-turf-profile-controller', 'gaip-hub-orchestrator', 'gaip-site-config'),
        gilba_asset_version( 'assets/hub-persistence.js' ),
        true
    );

    // ========================================
    // DAILY DASHBOARD v1.0.0
    // At-a-glance dashboard with key turf management metrics
    // Growth potential, disease risk, stress, weather, irrigation, actions
    // ========================================
    wp_enqueue_script(
        'gaip-daily-dashboard',
        $plugin_url . '/assets/daily-dashboard.js',
        array('gaip-hub-js', 'gaip-hub-persistence', 'gaip-climate-engine', 'gaip-species-controller'),
        gilba_asset_version( 'assets/daily-dashboard.js' ),
        true
    );

    // ========================================
    // PRIORITY ACTION QUEUE v1.0.0
    // Sits between Daily Dashboard scorecards and module panels.
    // Reads from SSOT canonical state — no engine changes required.
    // Renders urgency-sorted action items from all engines.
    // ========================================
    wp_enqueue_script(
        'gaip-priority-queue',
        $plugin_url . '/assets/priority-action-queue.js',
        array('gaip-hub-js', 'gaip-daily-dashboard'),
        gilba_asset_version( 'assets/priority-action-queue.js' ),
        true
    );
    wp_script_add_data('gaip-priority-queue', 'exclude-from-minification', true);
    wp_enqueue_style(
        'gaip-priority-queue',
        $plugin_url . '/assets/priority-action-queue.css',
        array(),
        gilba_asset_version( 'assets/priority-action-queue.css' )
    );

    // ========================================
    // DECISION STATE MACHINE v1.0.0 (b35fix219)
    // engine: reads GAIP engine globals, StorageAdapter persistence
    // ui: render layer, fork, queue rail, support chain
    // ========================================
    wp_enqueue_style(
        'gaip-decision-css',
        $plugin_url . '/assets/gaip-decision.css',
        array( 'gaip-hub-css' ),
        gilba_asset_version( 'assets/gaip-decision.css' )
    );

    wp_enqueue_script(
        'gaip-decision-engine',
        $plugin_url . '/assets/gaip-decision-engine.js',
        array( 'gaip-hub-js', 'gilba-storage-ns', 'gaip-priority-queue' ),
        gilba_asset_version( 'assets/gaip-decision-engine.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-decision-ui',
        $plugin_url . '/assets/gaip-decision-ui.js',
        array( 'gaip-decision-engine', 'gaip-hub-orchestrator' ),
        gilba_asset_version( 'assets/gaip-decision-ui.js' ),
        true
    );

    // Evidence View — b35fix229
    wp_enqueue_style(
        'gaip-evidence-css',
        $plugin_url . '/assets/gaip-evidence.css',
        array( 'gaip-hub-css' ),
        gilba_asset_version( 'assets/gaip-evidence.css' )
    );
    wp_enqueue_script(
        'gaip-evidence-ui',
        $plugin_url . '/assets/gaip-evidence-ui.js',
        array( 'gaip-hub-js', 'gaip-decision-engine' ),
        gilba_asset_version( 'assets/gaip-evidence-ui.js' ),
        true
    );

    // ========================================
    // FLOATING RUN BUTTON v1.0.0
    // Fixed-position "Update" FAB for quick access to Run Analysis
    // Keyboard shortcut: Ctrl+Enter (Cmd+Enter on Mac)
    // Auto-hides when original button is in viewport
    // ========================================
    wp_enqueue_script(
        'gaip-floating-run-button',
        $plugin_url . '/assets/floating-run-button.js',
        array('gaip-hub-js'),
        gilba_asset_version( 'assets/floating-run-button.js' ),
        true
    );
    // ========================================

    // ========================================
    // AUTO-REFRESH v1.0.0
    // For returning users, auto-runs analysis on page load
    // so dashboard shows live climate-driven data immediately.
    // Waits for persistence restore, then triggers run button.
    // ========================================
    wp_enqueue_script(
        'gaip-auto-refresh',
        $plugin_url . '/assets/auto-refresh.js',
        array('gaip-hub-js', 'gaip-hub-persistence', 'gaip-daily-dashboard', 'gaip-floating-run-button', 'gaip-site-setup-wizard'),
        gilba_asset_version( 'assets/auto-refresh.js' ),
        true
    );

    // ========================================
    // CARD LAYOUT REDESIGN v1.0.0
    // Phase 3: Progressive disclosure card layout.
    // Results as collapsible cards, inputs collapsed by default.
    // Pure DOM restructuring — no PHP changes to result blocks.
    // ========================================
    wp_enqueue_script(
        'gaip-card-layout-redesign',
        $plugin_url . '/assets/card-layout-redesign.js',
        array('gaip-hub-js', 'gaip-daily-dashboard', 'gaip-auto-refresh'),
        gilba_asset_version( 'assets/card-layout-redesign.js' ),
        true
    );

    // ========================================
    // TAB NAVIGATION v1.0.0
    // Phase 4: Today / Analysis / Programmes / Reports tabs.
    // Shows/hides groups of existing cards — no DOM destruction.
    // ========================================
    wp_enqueue_script(
        'gaip-tab-navigation',
        $plugin_url . '/assets/tab-navigation.js',
        array('gaip-hub-header-bar', 'gaip-daily-dashboard', 'gaip-card-layout-redesign'),
        gilba_asset_version( 'assets/tab-navigation.js' ),
        true
    );

    // ========================================
    // QUICK-JUMP NAV v1.0.0 (b35fix357)
    // Floating bottom-left tab pill that appears when the main tab bar
    // scrolls out of viewport. Mirrors floating-run-button.js placement
    // (bottom-right) so the two FABs do not collide.
    // ========================================
    wp_enqueue_script(
        'gaip-quick-jump-nav',
        $plugin_url . '/assets/quick-jump-nav.js',
        array('gaip-tab-navigation'),
        gilba_asset_version( 'assets/quick-jump-nav.js' ),
        true
    );

    // ========================================
    // NUTRITION CALENDAR MODULE v1.0.0
    // GP-weighted nutrient distribution calendar with MLSN/SLAN methodology
    // ========================================
    wp_enqueue_script(
        'gaip-nutrition-calendar',
        $plugin_url . '/assets/nutrition-calendar.js',
        array('gaip-classification-constants', 'gaip-hub-js', 'gaip-nutrition-summary', 'gaip-climate-v2'),
        gilba_asset_version( 'assets/nutrition-calendar.js' ),
        true
    );

    wp_enqueue_style(
        'gaip-nutrition-calendar-css',
        $plugin_url . '/assets/nutrition-calendar.css',
        array('gaip-hub-css'),
        gilba_asset_version( 'assets/nutrition-calendar.css' )
    );

    // ========================================
    // REGIONAL FERTILISER PRODUCTS — Always loaded
    // Client-side JS handles region gating (isNewZealand() / isAustralia()).
    // Previously conditional on PHP user_meta location, but site switching
    // is client-side so scripts weren't available after cross-region switches
    // within the same page load. ~383 KB total, acceptable tradeoff. v10.9.9
    // ========================================
    wp_enqueue_script(
        'gaip-prebbles-products',
        $plugin_url . '/assets/prebbles-products.js',
        array('gaip-nutrition-calendar'),
        gilba_asset_version( 'assets/prebbles-products.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-nutrition-prebble-integration',
        $plugin_url . '/assets/nutrition-prebble-integration.js',
        array('gaip-nutrition-calendar', 'gaip-prebbles-products'),
        gilba_asset_version( 'assets/nutrition-prebble-integration.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-au-fertiliser-products',
        $plugin_url . '/assets/au-fertiliser-products.js',
        array('gaip-nutrition-calendar'),
        gilba_asset_version( 'assets/au-fertiliser-products.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-nutrition-au-fertiliser-integration',
        $plugin_url . '/assets/nutrition-au-fertiliser-integration.js',
        array('gaip-nutrition-calendar', 'gaip-au-fertiliser-products', 'gaip-mlsn-progressive'),
        gilba_asset_version( 'assets/nutrition-au-fertiliser-integration.js' ),
        true
    );

    // ========================================
    // UK FERTILISER DATABASE + INTEGRATION (b35fix293)
    // 195 UK-specific products (ICL, Agrovista, ReGen, OAS/Headland)
    // with nForm tagging, SGN surface gating, and N-dominant scorer.
    // Loaded unconditionally (same rationale as AU/NZ: client-side
    // site switching means scripts must be available for cross-region switches).
    // ========================================
    wp_enqueue_script(
        'gaip-uk-fertiliser-products',
        $plugin_url . '/assets/uk-fertiliser-products.js',
        array('gaip-nutrition-calendar'),
        gilba_asset_version( 'assets/uk-fertiliser-products.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-nutrition-uk-fertiliser-integration',
        $plugin_url . '/assets/nutrition-uk-fertiliser-integration.js',
        array('gaip-nutrition-calendar', 'gaip-uk-fertiliser-products', 'gaip-mlsn-progressive'),
        gilba_asset_version( 'assets/nutrition-uk-fertiliser-integration.js' ),
        true
    );

    // ========================================
    // TISSUE CORRECTIVE ENGINE v2.0.0 (pure)
    // Generates foliar supplementation overlays on nutrition calendar
    // based on tissue test results cross-referenced with soil/water data.
    // Pure function — no DOM reads, event-driven integration via hub-tissue-v3.
    // v2.0: soil ratio antagonism (K:Mg, Mg:K), Mg:K patch included.
    // Legacy tissue-corrective-engine.js retired.
    // ========================================
    wp_enqueue_script(
        'gaip-tissue-corrective-engine',
        $plugin_url . '/assets/tissue-corrective-engine-pure.js',
        array('gaip-classification-constants', 'gaip-nutrition-calendar', 'gaip-tissue-engine', 'gaip-hub-js'),
        gilba_asset_version( 'assets/tissue-corrective-engine-pure.js' ),
        true
    );

    // Localize script with AJAX URL and saved location
    $location_manager = Gilba_Location_Manager::get_instance();
    $saved_location = $location_manager->get_saved_location();
    
    wp_localize_script(
        'gaip-hub-js',
        'GAIP_HUB_CONFIG',
        array(
            'openMeteoUrl' => 'https://api.open-meteo.com/v1/forecast',
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'restUrl' => rest_url('gilba/v1/'),
            'savedLocation' => $saved_location,
            'nonce' => wp_create_nonce('gilba_hub_nonce'),
            'restNonce' => wp_create_nonce('wp_rest'),
            'userId' => get_current_user_id(),
            'hubMode' => defined( 'GILBA_HUB_MODE' ) ? GILBA_HUB_MODE : 'agronomic',
        )
    );

    // ========================================
    // UNIFIED DESIGN SYSTEM v1.0
    // Must load LAST to override all module-specific styles
    // ========================================
    wp_enqueue_style(
        'gaip-design-system',
        $plugin_url . '/assets/gaip-design-system.css',
        array('gaip-hub-css'),
        gilba_asset_version( 'assets/gaip-design-system.css' )
    );

    // ========================================
    // MOBILE RESPONSIVE LAYER v1.0
    // Override-only CSS inside @media queries.
    // Zero effect on desktop layout.
    // ========================================
    wp_enqueue_style(
        'gaip-mobile',
        $plugin_url . '/assets/gaip-mobile.css',
        array('gaip-design-system'),
        gilba_asset_version( 'assets/gaip-mobile.css' )
    );

    // ========================================
    // SITE SETUP WIZARD v1.0.0
    // First-run onboarding modal.
    // Loads after TurfProfile controller + regional profiles.
    // wp_localize_script passes first-run flag + saved location.
    // ========================================
    wp_enqueue_script(
        'gaip-site-setup-wizard',
        $plugin_url . '/assets/site-setup-wizard.js',
        array('gaip-turf-profile-controller', 'gaip-regional-profiles'),
        gilba_asset_version( 'assets/site-setup-wizard.js' ),
        true
    );

    wp_localize_script(
        'gaip-site-setup-wizard',
        'GAIP_WIZARD_CONFIG',
        array(
            'wizardComplete' => gilba_is_wizard_complete(),
            'savedLocation'  => $saved_location,
            'ajaxUrl'        => admin_url('admin-ajax.php'),
            'nonce'          => wp_create_nonce('gilba_hub_nonce'),
        )
    );

    // ========================================
    // HUB HEADER BAR v1.0.0
    // Sticky profile summary bar.
    // Phase 1 of UI redesign — pure addition.
    // ========================================
    wp_enqueue_script(
        'gaip-hub-header-bar',
        $plugin_url . '/assets/hub-header-bar.js',
        array('gaip-turf-profile-controller', 'gaip-regional-profiles'),
        gilba_asset_version( 'assets/hub-header-bar.js' ),
        true
    );

    // ========================================
    // MOBILE TURF PROFILE BOTTOM SHEET v1.0.0
    // Floating FAB + bottom sheet for mobile
    // turf profile settings. Only activates
    // on screens ≤ 768px. No server deps.
    // ========================================
    wp_enqueue_script(
        'gaip-mobile-turf-sheet',
        $plugin_url . '/assets/mobile-turf-sheet.js',
        array('gaip-turf-profile-controller', 'gaip-hub-header-bar'),
        gilba_asset_version( 'assets/mobile-turf-sheet.js' ),
        true
    );

    // ========================================
    // SPRAY LOG v1.0.0
    // Application diary — REST client + UI.
    // Loads after sample manager (for site context).
    // ========================================
    wp_enqueue_script(
        'gaip-spray-log',
        $plugin_url . '/assets/spray-log.js',
        array('gaip-hub-js'),
        gilba_asset_version( 'assets/spray-log.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-spray-log-ui',
        $plugin_url . '/assets/spray-log-ui.js',
        array('gaip-spray-log', 'gaip-uv-residual'),
        gilba_asset_version( 'assets/spray-log-ui.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-spray-log-integration',
        $plugin_url . '/assets/spray-log-integration.js',
        array('gaip-spray-log-ui', 'gaip-spray-log'),
        gilba_asset_version( 'assets/spray-log-integration.js' ),
        true
    );

    wp_enqueue_script(
        'gaip-spray-log-cascade',
        $plugin_url . '/assets/spray-log-cascade.js',
        array('gaip-spray-log', 'gaip-spray-log-integration', 'gaip-uv-residual'),
        gilba_asset_version( 'assets/spray-log-cascade.js' ),
        true
    );

    // pgr-spray-log-sync.js removed — b35fix233 (cascade is SSOT)

    // b35fix294: Printable spray log report for audit/compliance
    wp_enqueue_script(
        'gaip-spray-log-print',
        $plugin_url . '/assets/spray-log-print.js',
        array('gaip-spray-log', 'gaip-spray-log-ui'),
        gilba_asset_version( 'assets/spray-log-print.js' ),
        true
    );

    // ========================================
    // ALERTS — SMS/Email threshold notifications (b35fix107)
    // Listens for gaip:orchestrator-complete, posts results to
    // /gilba/v1/alert-check. PHP handles evaluation + ClickSend delivery.
    // Depends on hub-orchestrator (for result globals) and sample-manager
    // (for site contact config).
    // ========================================
    wp_enqueue_script(
        'gaip-alerts',
        $plugin_url . '/assets/gilba-alerts.js',
        array('gaip-hub-js', 'gaip-sample-manager'),
        gilba_asset_version( 'assets/gilba-alerts.js' ),
        true
    );

    // ========================================
    // UV PHOTOLYSIS FUNGICIDE RESIDUAL ENGINE v1.0.0
    // First-order decay model for fungicide residual efficacy.
    // Three pathways: UV photolysis, rainfall washoff, biological degradation.
    // Exposes window.GAIP_UV_RESIDUAL — wired into spray-log-ui.js.
    // Sources: Monadjemi et al. 2011; Wang et al. 2022; Vione et al. 2022;
    //          Duan et al. 2013; FAO JMPR 2008; Agronomy Journal 2021.
    // ========================================
    wp_enqueue_script(
        'gaip-uv-residual',
        $plugin_url . '/assets/uv-residual-engine.js',
        array('gaip-spray-log', 'gaip-climate-engine'),
        gilba_asset_version( 'assets/uv-residual-engine.js' ),
        true
    );

    // ========================================
    // SITE SETTINGS SLIDE-OVER PANEL v1.0.0
    // Phase 2 of UI redesign.
    // Slide-over panel replaces scroll-to-card.
    // Reads/writes same DOM elements as Turf Profile card.
    // ========================================
    wp_enqueue_script(
        'gaip-site-settings-panel',
        $plugin_url . '/assets/site-settings-panel.js',
        array('gaip-hub-header-bar', 'gaip-turf-profile-controller'),
        gilba_asset_version( 'assets/site-settings-panel.js' ),
        true
    );

    // ========================================
    // SITE DATA TRANSFER v1.0.0
    // Export active site to .json, import on any Hub instance.
    // Bundle: samples + site config + turf profile + sensor mapping.
    // ========================================
    wp_enqueue_script(
        'gaip-site-data-transfer',
        $plugin_url . '/assets/site-data-transfer.js',
        array('gaip-sample-manager', 'gaip-site-config', 'gaip-turf-profile-controller'),
        gilba_asset_version( 'assets/site-data-transfer.js' ),
        true
    );
}
add_action('wp_enqueue_scripts', 'gaip_hub_enqueue_assets');

// ============================================
// STADIUM MODE ENQUEUE
// All stadium JS/CSS — only loaded when GILBA_HUB_MODE === 'stadium'
// To activate: define( 'GILBA_HUB_MODE', 'stadium' ) in wp-config.php
// ============================================
function gssh_hub_enqueue_stadium_assets() {
    // Only load assets on pages/posts that use the shortcode
    global $post;
    if ( ! is_a( $post, 'WP_Post' ) ) {
        return;
    }
    // Fire when: dedicated gssh_hub shortcode, GILBA_HUB_MODE === 'stadium',
    // OR [gaip_hub mode="stadium"] attribute on this page.
    $has_shortcode = has_shortcode( $post->post_content, 'gssh_hub' )
        || has_shortcode( $post->post_content, 'gaip_hub' );
    if ( ! $has_shortcode ) {
        return;
    }
    // gssh_hub shortcode is always a stadium page.
    // gaip_hub requires either GILBA_HUB_MODE === 'stadium' or mode="stadium" attribute.
    $is_stadium_page = has_shortcode( $post->post_content, 'gssh_hub' )
        || ( GILBA_HUB_MODE === 'stadium' )
        || gilba_page_has_stadium_mode( $post );
    if ( ! $is_stadium_page ) {
        return;
    }

    // Don't load hub assets if the access gate is active and user isn't authenticated.
    // This prevents JS modules from rendering hub UI behind the gate form.
    if ( function_exists('gssh_access_verify') && defined('GSSH_HUB_ACCESS_ENABLED') && GSSH_HUB_ACCESS_ENABLED && ! gssh_access_verify() ) {
        return;
    }
    
    $plugin_url = plugins_url( '', __FILE__ );

    // ========================================
    // NAMESPACED LOCALSTORAGE SHIM
    // Must load before any module that reads/writes localStorage.
    // Sets GILBA_PLUGIN_NS = "gssh" so keys are prefixed gilba_gssh_*
    // and do not collide with GAIP Hub keys.
    // ========================================
    wp_enqueue_script(
        'gilba-storage-ns',
        $plugin_url . '/assets/gilba-storage-ns.js',
        array(),
        gilba_asset_version( 'assets/gilba-storage-ns.js' ),
        true
    );
    wp_add_inline_script( 'gilba-storage-ns', 'window.GILBA_PLUGIN_NS = "gssh";', 'before' );

    // b35fix271: Site context — single source of truth for active site/venue ID.
    wp_enqueue_script(
        'gssh-site-context',
        $plugin_url . '/assets/gaip-site-context.js',
        array('gilba-storage-ns'),
        gilba_asset_version( 'assets/gaip-site-context.js' ),
        true
    );

    // One-time migration: copies pre-b35fix91 bare localStorage keys to namespaced equivalents.
    wp_enqueue_script(
        'gilba-storage-migrate',
        $plugin_url . '/assets/gilba-storage-migrate.js',
        array('gilba-storage-ns'),
        gilba_asset_version( 'assets/gilba-storage-migrate.js' ),
        true
    );

    // Register gaip-charts here so GSSH forecast scripts (disease-forecast,
    // irrigation-forecast, shade-forecast, pgr-forecast) can declare it as a
    // dependency. gilba-charts.js is identical in both modes — the handle
    // just needs to be registered before the dependent wp_enqueue_script calls.
    wp_register_script(
        'gaip-charts',
        $plugin_url . '/assets/gilba-charts.js',
        array(),
        time(),
        true
    );

    wp_register_style(
        'gssh-hub-css',
        $plugin_url . '/assets/hub.css',
        array(),
        time()
    );
    wp_enqueue_style('gssh-hub-css');

    // Leaflet map for location picker
    wp_enqueue_style(
        'leaflet-css',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
        array(),
        '1.9.4'
    );
    wp_enqueue_script(
        'leaflet-js',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        array(),
        '1.9.4',
        true
    );

    // Standalone Leaflet map initializer — loaded as external JS to avoid
    // inline <script> encoding issues with non-ASCII characters.
    wp_enqueue_script(
        'gssh-leaflet-map-init',
        $plugin_url . '/assets/leaflet-map-init.js',
        array('jquery', 'leaflet-js'),
        time(),
        true
    );

    // Tissue testing CSS
    wp_enqueue_style(
        'gssh-tissue-css',
        $plugin_url . '/assets/tissue.css',
        array(),
        time()
    );

    // Column collapse fix - prevents table columns from collapsing to zero width
    // Fixes tissue table and TDR table character-by-character vertical text wrapping
    wp_enqueue_style(
        'gssh-column-collapse-fix',
        $plugin_url . '/assets/column-collapse-fix.css',
        array('gssh-tissue-css', 'gssh-hub-css'),
        time()
    );

    // ========================================
    // SHARED UTILITIES v1.0.0 - MUST LOAD FIRST
    // gssh-utils.js deleted — namespace-rename-only fork of gaip-utils.js.
    // All GSSH scripts that depended on 'gssh-utils' now depend on 'gaip-utils'.
    wp_enqueue_script(
        'gssh-utils',
        $plugin_url . '/assets/gaip-utils.js',
        array(),  // No dependencies - loads before everything
        time(),
        true
    );

    // gaip-utils also registered here so stadium-page deps resolve correctly
    // (gaip_hub_enqueue_assets() bails on stadium pages, so gaip-utils would
    // otherwise never be registered when gssh modules depend on it)
    wp_enqueue_script(
        'gaip-utils',
        $plugin_url . '/assets/gaip-utils.js',
        array(),
        time(),
        true
    );

    // ========================================
    // SPECIES CONTROLLER v1.0.0 - MUST LOAD EARLY
    // Single Source of Truth for species identity
    // ALL modules must use SpeciesController.getSpecies() etc.
    // ========================================
    wp_enqueue_script(
        'gssh-species-controller',
        $plugin_url . '/assets/species-controller.js',
        array('gssh-utils'),  // Depends on shared utils
        time(),
        true
    );

    // ========================================
    // IDENTITY ENFORCEMENT v1.0.0
    // Tiered validation of primary identity keys
    // TIER 0: speciesKey (hard fail)
    // TIER 1: surfaceKey, climateRegimeKey, turfIntentKey (soft default)
    // TIER 2: Output gating based on assumptions
    // ========================================
    wp_enqueue_script(
        'gssh-identity-enforcement',
        $plugin_url . '/assets/identity-enforcement.js',
        array('gssh-species-controller'),
        time(),
        true
    );

    // ========================================
    // CLIMATE ENGINE (must load before hub.js)
    // ========================================
    wp_enqueue_script(
        'gssh-climate-engine',
        $plugin_url . '/assets/climate-engine.js',
        array('gssh-species-controller'),  // Now depends on species controller
        time(),
        true
    );

    // ========================================
    // WEATHER RESILIENCE v1.0
    // Caching and graceful degradation for weather API
    // ========================================
    wp_enqueue_script(
        'gssh-weather-resilience',
        $plugin_url . '/assets/weather-resilience.js',
        array('gssh-climate-engine'),  // Depends on climate engine
        time(),
        true
    );

    // ========================================
    // AMBIENT DLI ENGINE v1.0
    // Auto-calculates Daily Light Integral from Open-Meteo solar radiation
    // Source: McCree (1972), Faust & Logan (2018)
    // Provides "open-field" DLI baseline for shade deficit calculations
    // ========================================
    wp_enqueue_script(
        'gssh-ambient-dli-engine',
        $plugin_url . '/assets/ambient-dli-engine.js',
        array('gssh-species-controller', 'gssh-climate-engine'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-ambient-dli-integration',
        $plugin_url . '/assets/ambient-dli-integration.js',
        array('gssh-ambient-dli-engine', 'gssh-climate-engine'),
        time(),
        true
    );

    // ========================================
    // GAIP SOIL TEMPERATURE INTEGRATION v1.0
    // gssh-soil-temp-integration.js deleted — namespace-rename-only fork of gaip-soil-temp-integration.js.
    wp_enqueue_script(
        'gssh-soil-temp-integration',
        $plugin_url . '/assets/gaip-soil-temp-integration.js',
        array('gssh-climate-engine'),  // Depends on climate engine
        time(),
        true
    );

    // ========================================
    // REGIONAL PROFILES v1.0.0
    // Location-aware turf management data
    // Disease pressure, variety databases, climate characteristics
    // ========================================
    wp_enqueue_script(
        'gssh-regional-profiles',
        $plugin_url . '/assets/regional-profiles.js',
        array(),  // No dependencies - loads early
        '1.0.2',  // v1.0.2: Added waiteaPatch multiplier for NZ
        true
    );

    // ========================================
    // VARIETY TRAITS (must load before turf profile for hemisphere detection)
    // v1.14.1: SpeciesController integration for couch/bermuda mapping
    // ========================================
    wp_enqueue_script(
        'gssh-variety-traits',
        $plugin_url . '/assets/gssh-variety-traits.js',
        array('gssh-species-controller'),
        time(),
        true
    );

    // UK/European variety traits (BSPB/STRI data)
    // Used for Northern Hemisphere locations (>45°N)
    // v1.4.0: Split bentgrass into species-specific functions (creeping vs browntop)
    wp_enqueue_script(
        'gssh-uk-variety-traits',
        $plugin_url . '/assets/uk-variety-traits.js',
        array('gssh-variety-traits'),
        time(),
        true
    );

    // Scanturf variety traits (Nordic trials)
    // Used for Scandinavia (>54°N, Nordic countries)
    wp_enqueue_script(
        'gssh-scanturf-variety-traits',
        $plugin_url . '/assets/scanturf-variety-traits.js',
        array('gssh-variety-traits'),
        time(),
        true
    );

    // GEVES variety traits (French/Continental Europe)
    // Used for Continental Europe (France, Belgium, Netherlands)
    wp_enqueue_script(
        'gssh-geves-variety-traits',
        $plugin_url . '/assets/geves-variety-traits.js',
        array('gssh-variety-traits'),
        time(),
        true
    );

    // BSA variety traits (German trials)
    // Used for Germany - Bundessortenamt Rasengräser data (PRG + Bentgrass)
    wp_enqueue_script(
        'gssh-bsa-variety-traits',
        $plugin_url . '/assets/bsa-variety-traits.js',
        array('gssh-variety-traits'),
        time(),
        true
    );

    // Japan variety traits
    // Used for Japan - Zoysia, Bentgrass, PRG overseed (NTEP-sourced)
    wp_enqueue_script(
        'gssh-japan-variety-traits',
        $plugin_url . '/assets/japan-variety-traits.js',
        array('gssh-variety-traits'),
        time(),
        true
    );

    // Scandinavia variety traits
    // Used for Sweden, Norway, Denmark, Finland - SCANTURF 2024-2025 trial data
    wp_enqueue_script(
        'gssh-scandinavia-variety-traits',
        $plugin_url . '/assets/scandinavia-variety-traits.js',
        array('gssh-variety-traits'),
        time(),
        true
    );

    // Exclude all GSSH variety trait files from minification (same reason as GAIP).
    wp_script_add_data('gssh-variety-traits',             'exclude-from-minification', true);
    wp_script_add_data('gssh-uk-variety-traits',          'exclude-from-minification', true);
    wp_script_add_data('gssh-scanturf-variety-traits',    'exclude-from-minification', true);
    wp_script_add_data('gssh-geves-variety-traits',       'exclude-from-minification', true);
    wp_script_add_data('gssh-bsa-variety-traits',         'exclude-from-minification', true);
    wp_script_add_data('gssh-japan-variety-traits',       'exclude-from-minification', true);
    wp_script_add_data('gssh-scandinavia-variety-traits', 'exclude-from-minification', true);
    wp_script_add_data('gssh-nz-fine-fescue-traits',      'exclude-from-minification', true);

    // ========================================
    // NZ FINE FESCUE VARIETY TRAITS v1.0.0
    // Chewings, Slender Creeping Red, Strong Creeping Red
    // NZ ONLY (fine fescues don't tolerate Australian summers)
    // Data: NTEP 2014/2020, BSPB 2025, NZ supplier data (PGG Wrightson, Living Turf)
    // ========================================
    wp_enqueue_script(
        'gssh-nz-fine-fescue-traits',
        $plugin_url . '/assets/nz-fine-fescue-traits.js',
        array('gssh-variety-traits'),
        time(),
        true
    );

    // ========================================
    // TURF PROFILE CONTROLLER v2.9.1
    // Foundational context - must load early
    // Manages turf type, species, variety cascading
    // Full regional variety selection (UK/Scanturf/GEVES/BSA/Japan/Scandinavia/NTEP/NZ Fine Fescue)
    // v2.9.1: Added NZ Fine Fescue species support
    // ========================================
    wp_enqueue_script(
        'gssh-turf-profile-controller',
        $plugin_url . '/assets/turf-profile-controller.js',
        array('gssh-variety-traits', 'gssh-regional-profiles', 'gssh-uk-variety-traits', 'gssh-scanturf-variety-traits', 'gssh-geves-variety-traits', 'gssh-bsa-variety-traits', 'gssh-japan-variety-traits', 'gssh-scandinavia-variety-traits', 'gssh-nz-fine-fescue-traits'),
        time(),
        true
    );

    // ========================================
    // NITROGEN PROGRAM VALIDATOR v1.0
    // Compares applied N vs growth-limited demand
    // Source: PACE Turf GP model, Carrow, Christians
    // ========================================
    wp_enqueue_script(
        'gssh-nitrogen-validator',
        $plugin_url . '/assets/nitrogen-validator.js',
        array('gssh-climate-engine'),
        time(),
        true
    );

    // ========================================
    // WEAR & RECOVERY ENGINE v1.5
    // Source: Baker/Gibbs/Adams STRI 1989/1992, GMA UK, Gilba Solutions
    // v1.5: Salinity penalty + stress aggregation integration
    // ========================================
    wp_enqueue_script(
        'gssh-wear-recovery-engine',
        $plugin_url . '/assets/wear-recovery-engine-pure.js',
        array(),  // No dependencies
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-wear-recovery-integration',
        $plugin_url . '/assets/wear-recovery-integration.js',
        array('gssh-wear-recovery-engine'),
        time(),
        true
    );

    // ========================================
    // OVERSEED WEAR MULTIPLIER v1.0
    // Enhanced species-aware overseed tolerance adjustment
    // Source: Auburn, Clemson, NTEP wear trials
    // ========================================
    wp_enqueue_script(
        'gssh-overseed-multiplier',
        $plugin_url . '/assets/overseed-multiplier.js',
        array('gssh-wear-recovery-engine'),
        time(),
        true
    );

    // ========================================
    // OVERSEED CLIMATE INTEGRATION v1.0
    // Temperature-dependent germination, establishment, and transition
    // Source: Beard (1973), Christians (2016), PACE Turf
    // v1.2.0: GAIP physics-based soil temp integration
    // v1.2.1: Fixed isC4Base detection for PRG-as-species overseed scenarios
    //         Now infers C4 base when C3 selected in C4-viable climate
    //         Auto-calculates seasonal c3Fraction, dispatches gilbaOverseedFractionUpdate
    // ========================================
    wp_enqueue_script(
        'gssh-overseed-climate',
        $plugin_url . '/assets/overseed-climate-integration.js',
        array('gssh-overseed-multiplier', 'gssh-climate-v2'),
        time(),
        true
    );

    // ========================================
    // SHADE ENGINE v2.0
    // Source: CanopyFlux solar geometry, Gilba Solutions
    // v2.0: N adjustment, Mowing height, PGR warning, Seasonal trajectory
    // v2.1: Respects effective species when overseed is dominant
    // v2.2: EUE integration, HOC-aware DLI, spectral prescriptions
    // ========================================
    
    // Environmental Utilisation Efficiency (EUE) Engine v1.0
    // Models Liebig's Law limiting factors on LED effectiveness
    // Source: Sodick Growth Equation Framework, Principality Stadium 2017 field data,
    //         "Lawn Growth Under Artificial Light" technical compendium
    wp_enqueue_script(
        'gssh-eue-engine',
        $plugin_url . '/assets/environmental-utilisation-engine.js',
        array(),  // No dependencies — pure calculation module
        time(),
        true
    );
    
    // EUE Integration Bridge — wires EUE engine into shade orchestrator,
    // LED prescription pipeline, and hub state cascade.
    // Listens for climate, shade, species events and runs EUE calculations.
    wp_enqueue_script(
        'gssh-eue-bridge',
        $plugin_url . '/assets/eue-integration-bridge.js',
        array('gssh-eue-engine'),
        time(),
        true
    );
    
    // Venue Readiness UI — renders Growth Environment Stack assessment card
    // in the stadium tab. Shows EUE factors, spectral prescriptions,
    // irrigation advisories, and HOC-aware DLI targets.
    wp_enqueue_script(
        'gssh-venue-readiness-ui',
        $plugin_url . '/assets/venue-readiness-ui.js',
        array('gssh-eue-engine', 'gssh-eue-bridge'),
        time(),
        true
    );

    // Plain-language operational summary card (Item 8)
    // Converts hub engine outputs into 3-5 actionable sentences for turf managers.
    wp_enqueue_script(
        'gssh-operational-summary',
        $plugin_url . '/assets/gssh-operational-summary.js',
        array('gssh-venue-readiness-ui', 'gssh-eue-bridge'),
        time(),
        true
    );

    // LED Vendor Export — Word report from rig/planner/EUE results (Item 9)
    wp_enqueue_script(
        'gssh-led-export',
        $plugin_url . '/assets/gssh-led-export.js',
        array('gssh-docx-lib', 'gssh-eue-bridge', 'gssh-venue-readiness-ui'),
        time(),
        true
    );
    
    wp_enqueue_script(
        'gssh-shade-engine',
        $plugin_url . '/assets/shade-engine.js',
        array('gssh-eue-engine'),  // EUE loads before shade engine
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-shade-integration',
        $plugin_url . '/assets/shade-integration.js',
        array('gssh-shade-engine'),
        time(),
        true
    );

    // ========================================
    // DLI-RECOVERY BRIDGE v1.0.0
    // Connects Shade Engine DLI output to Wear Recovery modifiers
    // Species-specific recovery penalties based on DLI vs min/target/optimal
    // Source: Wherley et al. (2005), Trappe et al. (2011), Bunnell et al. (2005),
    //         Bell & Danneberger (1999)
    // ========================================
    wp_enqueue_script(
        'gssh-dli-recovery-bridge',
        $plugin_url . '/assets/dli-recovery-bridge.js',
        array('gssh-utils', 'gssh-shade-engine'),
        time(),
        true
    );

    wp_enqueue_style(
        'gssh-shade-ui-css',
        $plugin_url . '/assets/shade-ui.css',
        array('gssh-hub-css'),
        time()
    );

    // ========================================
    // MAIN HUB (SSOT mode - routes through cascade orchestrator)
    // ========================================
    wp_enqueue_script(
    'gssh-hub-js',
    plugins_url('assets/hub-tissue-v3.js', __FILE__),
    array('gssh-climate-engine', 'gssh-wear-recovery-integration', 'gssh-shade-engine', 'gssh-cascade-orchestrator'),
    time(),
    true
    );

    // Tissue testing scripts
    wp_enqueue_script(
        'gssh-tissue-engine',
        $plugin_url . '/assets/tissue-engine.js',
        array(),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-tissue-interpretation',
        $plugin_url . '/assets/tissue-interpretation.js',
        array('gssh-tissue-engine'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-soil-tissue-integration',
        $plugin_url . '/assets/soil-tissue-integration.js',
        array('gssh-tissue-interpretation'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-tissue-ui',
        $plugin_url . '/assets/tissue-ui.js',
        array('gssh-tissue-interpretation', 'gssh-soil-tissue-integration'),
        time(),
        true
    );

    // ========================================
    // PROGRESSIVE DISCLOSURE MODULES
    // ========================================
    
    // MLSN Progressive Disclosure
    wp_enqueue_script(
        'gssh-mlsn-progressive',
        $plugin_url . '/assets/mlsn-progressive-disclosure.js',
        array('gssh-hub-js'),
        time(),
        true
    );

    // Mulder's Nutrient Interaction Checker
    wp_enqueue_script(
        'gssh-mulders',
        $plugin_url . '/assets/mulders-interaction-checker.js',
        array('gssh-mlsn-progressive'),
        gilba_asset_version( 'assets/mulders-interaction-checker.js' ),
        true
    );

    wp_enqueue_style(
        'gssh-mlsn-progressive-css',
        $plugin_url . '/assets/mlsn-progressive-disclosure.css',
        array('gssh-hub-css'),
        time()
    );

    // Ammonium Acetate Methodology (Hill Labs NZ)
    // Adds NZ-specific Olsen P + NH₄OAc interpretation ranges
    wp_enqueue_script(
        'gssh-ammonium-acetate',
        $plugin_url . '/assets/ammonium-acetate-methodology.js',
        array('gssh-mlsn-progressive', 'gssh-regional-profiles'),
        time(),
        true
    );

    // Cotula bowling green — NZ only. Hill Labs S78 ranges, empirical N program.
    // Must load after gssh-ammonium-acetate (uses isNewZealand() from that module).
    wp_enqueue_script(
        'gssh-cotula-bowling',
        $plugin_url . '/assets/cotula-bowling-green.js',
        array('gssh-ammonium-acetate', 'gssh-regional-profiles'),
        time(),
        true
    );

    // Nutrient Demand Engine (N-linked demand, Kussow et al. methodology)
    wp_enqueue_script(
        'gssh-nutrient-demand',
        $plugin_url . '/assets/nutrient-demand-engine.js',
        array('gssh-hub-js'),
        time(),
        true
    );

    // ========================================
    // GROWTH POTENTIAL ENGINE v1.0.0 (b35fix302a backfilled into GSSH in b35fix302b)
    // Pure PACE Turf GP model + Kreuser & Soldat plateau. No GSSH-specific
    // deps — engine is pure. Same handle as GAIP mode; only one fires per
    // request since modes are mutually exclusive.
    // ========================================
    wp_enqueue_script(
        'gilba-growth-potential-engine',
        $plugin_url . '/assets/growth-potential-engine.js',
        array(),  // Pure engine — no deps
        gilba_asset_version( 'assets/growth-potential-engine.js' ),
        false  // <head>
    );

    // ========================================
    // NUTRITION REQUIREMENT ENGINE v1.0.0 (b35fix302b)
    // Per-sample P/K/S/Ca/Mg + facility monthly N. Needed in GSSH because
    // shade impact on nutritional programme is a core GSSH use case.
    // ========================================
    wp_enqueue_script(
        'gilba-nutrition-requirement-engine',
        $plugin_url . '/assets/nutrition-requirement-engine.js',
        array('gilba-growth-potential-engine'),
        gilba_asset_version( 'assets/nutrition-requirement-engine.js' ),
        false  // <head>
    );

    // Nutrition Summary Integration (MLSN deficits + GP-weighted N distribution)
    // v1.1.4: SpeciesController integration for consistent species identity
    // b35fix302b: depends on gilba-nutrition-requirement-engine (Task 9 rewire).
    wp_enqueue_script(
        'gssh-nutrition-summary',
        $plugin_url . '/assets/nutrition-summary-integration.js',
        array('gssh-mlsn-progressive', 'gssh-nutrient-demand', 'gssh-species-controller', 'gilba-nutrition-requirement-engine'),
        time(),
        true
    );

    // Water Progressive Disclosure
    wp_enqueue_script(
        'gssh-water-progressive',
        $plugin_url . '/assets/water-progressive-disclosure-WITH-SOIL-INTERACTION.js',
        array('gssh-hub-js'),
        time(),
        true
    );

    // ========================================
    // SALINITY GROWTH PENALTY v1.0
    // Maas-Hoffman yield reduction model
    // Source: FAO, Harivandi, Carrow & Duncan
    // ========================================
    wp_enqueue_script(
        'gssh-salinity-penalty',
        $plugin_url . '/assets/salinity-penalty.js',
        array('gssh-water-progressive'),
        time(),
        true
    );

    // ========================================
    // SALINITY CLIMATE INTEGRATION v1.0
    // Temperature-dependent thresholds, compound stress, ET concentration
    // Source: Carrow & Duncan (1998), Marcum (2006), Mittler (2006)
    // ========================================
    wp_enqueue_script(
        'gssh-salinity-climate',
        $plugin_url . '/assets/salinity-climate-integration.js',
        array('gssh-salinity-penalty', 'gssh-climate-v2'),
        time(),
        true
    );

    // ========================================
    // PHYTOTOXICITY ENGINE v1.0
    // Direct foliar & root damage from Na, Cl, B
    // Source: Ayers & Westcot 1985, Carrow & Duncan 1998
    // ========================================
    wp_enqueue_script(
        'gssh-phytotoxicity',
        $plugin_url . '/assets/phytotoxicity-engine.js',
        array('gssh-water-progressive', 'gssh-variety-traits'),
        time(),
        true
    );

    // ========================================
    // WATER BLENDER MODULE v1.0
    // Multi-source water blending with full chemistry analysis
    // Source: Ayers & Westcot 1985, PACE Turf, Carrow & Duncan 1998
    // ========================================
    wp_enqueue_script(
        'gssh-water-blender',
        $plugin_url . '/assets/water-blender.js',
        array('gaip-utils', 'gssh-water-progressive'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-water-blender-ui',
        $plugin_url . '/assets/water-blender-ui.js',
        array('jquery', 'gssh-water-blender', 'gssh-water-progressive'),
        time(),
        true
    );

    // ========================================
    // AU VARIETY TRAITS v1.0.1
    // Fixed: global.VARIETY_TRAITS -> global.GSSH_VARIETY_TRAITS
    // ========================================
    wp_enqueue_script(
        'gssh-au-variety-traits',
        $plugin_url . '/assets/au-variety-traits.js',
        array('gssh-variety-traits'),
        time(),
        true
    );

    // ========================================
    // NZ VARIETY TRAITS v1.0.1
    // Fixed: global.VARIETY_TRAITS -> global.GSSH_VARIETY_TRAITS
    // ========================================
    wp_enqueue_script(
        'gssh-nz-variety-traits',
        $plugin_url . '/assets/nz-variety-traits.js',
        array('gssh-variety-traits'),
        time(),
        true
    );
    wp_script_add_data('gssh-au-variety-traits', 'exclude-from-minification', true);
    wp_script_add_data('gssh-nz-variety-traits', 'exclude-from-minification', true);

    // ========================================
    // VARIETY TRAITS INTEGRATION v1.7.14
    // AU/NZ region routing, GEVES break fix, all regional databases
    // ========================================
    wp_enqueue_script(
        'gssh-variety-integration',
        $plugin_url . '/assets/variety-traits-integration.js',
        array('gssh-variety-traits', 'gssh-uk-variety-traits', 'gssh-scanturf-variety-traits', 'gssh-geves-variety-traits', 'gssh-bsa-variety-traits', 'gssh-japan-variety-traits', 'gssh-scandinavia-variety-traits', 'gssh-nz-fine-fescue-traits', 'gssh-regional-profiles', 'gssh-au-variety-traits', 'gssh-nz-variety-traits'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-variety-selector-ui',
        $plugin_url . '/assets/variety-selector-ui.js',
        array('gssh-variety-integration'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-cultivar-profile-ui',
        $plugin_url . '/assets/cultivar-profile-ui.js',
        array('gssh-variety-integration'),
        time(),
        true
    );

    // ========================================
    // NZ FINE FESCUE INTEGRATION v1.0.0
    // Wires NZ fine fescue traits into Hub systems
    // Must load AFTER variety-traits-integration.js and turf-profile-controller.js
    // ========================================
    wp_enqueue_script(
        'gssh-nz-fine-fescue-integration',
        $plugin_url . '/assets/nz-fine-fescue-integration.js',
        array('gssh-variety-integration', 'gssh-turf-profile-controller', 'gssh-nz-fine-fescue-traits'),
        time(),
        true
    );

    // ========================================
    // PGR MODULE v3.0
    // Species-specific GDD bases per Kreuser/Reasor:
    // - C3 grasses: Base 0°C (Kreuser & Soldat 2011)
    // - C4 grasses: Base 10°C (Reasor et al. 2018)
    // Validated sinewave models for HIGH confidence species
    // Added Prohexadione-Ca (Anuew)
    // v3.4.0: Turf profile surface detection fix
    // ========================================
    wp_enqueue_script(
        'gssh-pgr-module',
        $plugin_url . '/assets/gssh-pgr-module-v3.js',
        array('gssh-climate-engine', 'gssh-shade-engine'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-pgr-ui',
        $plugin_url . '/assets/pgr-ui.js',
        array('gssh-pgr-module'),
        time(),
        true
    );

    // ========================================
    // DMI GROWTH SUPPRESSION v1.0
    // Models PGR-like effects of DMI fungicides
    // Integrates with PGR program for combined suppression warnings
    // ========================================
    wp_enqueue_script(
        'gssh-dmi-suppression',
        $plugin_url . '/assets/dmi-growth-suppression.js',
        array('gssh-pgr-module'),
        time(),
        true
    );

    // ========================================
    // IRRIGATION SCHEDULER v1.1
    // FAO-56 ET, variety Kc modifiers, SMD tracking, OM effects
    // v1.3.3: Returns waterBalance even when forecast unavailable
    // ========================================
    wp_enqueue_script(
        'gssh-irrigation-scheduler',
        $plugin_url . '/assets/irrigation-scheduler.js',
        array('gaip-utils', 'gssh-climate-engine', 'gssh-variety-integration'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-irrigation-ui',
        $plugin_url . '/assets/irrigation-scheduler-ui.js',
        array('gssh-irrigation-scheduler'),
        time(),
        true
    );

    // ========================================
    // CLIMATE MODULE v2.0
    // Variety-aware: winterkill, heat stress, dormancy
    // ========================================
    wp_enqueue_script(
        'gssh-climate-v2',
        $plugin_url . '/assets/climate-module-v2.js',
        array('gaip-utils', 'gssh-climate-engine', 'gssh-variety-integration'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-climate-v2-ui',
        $plugin_url . '/assets/climate-module-v2-ui.js',
        array('gssh-climate-v2'),
        time(),
        true
    );

    // Basic fallback is built into hub-tissue-v3.js (renderBasicClimateInfo)

    // ========================================
    // CLIMATE MODULE v2.1 - DUAL METRICS
    // Current vs 8-Day Outlook using real forecast data
    // Adds trajectory indicators and stress outlook
    // v2.1.1: Respects effective species when overseed is dominant
    // ========================================
    wp_enqueue_script(
        'gssh-climate-v2-dual-metrics',
        $plugin_url . '/assets/climate-module-v2.1-dual-metrics.js',
        array('gaip-utils', 'gssh-climate-v2'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-climate-v2-dual-metrics-ui',
        $plugin_url . '/assets/climate-module-v2.1-ui.js',
        array('gssh-climate-v2-dual-metrics', 'gssh-climate-v2-ui'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-climate-v2-dual-integration',
        $plugin_url . '/assets/climate-module-v2.1-integration.js',
        array('gssh-climate-v2-dual-metrics-ui'),
        time(),
        true
    );

    // ========================================
    // DEW PREDICTION MODULE v1.0
    // Sports turf only: dew forecasting, match-day conditions
    // Feeds leaf wetness data to disease engine
    // ========================================
    wp_enqueue_script(
        'gssh-dew-prediction-engine',
        $plugin_url . '/assets/dew-prediction-engine.js',
        array('gssh-climate-engine'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-dew-prediction-ui',
        $plugin_url . '/assets/dew-prediction-ui.js',
        array('gssh-dew-prediction-engine'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-dew-prediction-integration',
        $plugin_url . '/assets/dew-prediction-integration.js',
        array('gssh-dew-prediction-engine', 'gssh-dew-prediction-ui', 'gssh-hub-js'),
        time(),
        true
    );

    wp_enqueue_style(
        'gssh-water-progressive-css',
        $plugin_url . '/assets/water-progressive-disclosure.css',
        array('gssh-hub-css'),
        time()
    );

    wp_enqueue_style(
        'gssh-water-blender-css',
        $plugin_url . '/assets/water-blender.css',
        array('gssh-water-progressive-css'),
        time()
    );

    // Tissue Progressive Disclosure
    wp_enqueue_script(
        'gssh-tissue-progressive',
        $plugin_url . '/assets/tissue-progressive-disclosure.js',
        array('gssh-hub-js'),
        time(),
        true
    );

    wp_enqueue_style(
        'gssh-tissue-progressive-css',
        $plugin_url . '/assets/mlsn-progressive-disclosure.css',  // Reuse MLSN styles
        array('gssh-hub-css'),
        time()
    );

    // ========================================
    // EXTENDED REGIONAL FUNGICIDES v1.0.0
    // Nordic countries (SE, DK, NO) + Japan expanded databases
    // Must load BEFORE disease-engine.js
    // ========================================
    wp_enqueue_script(
        'gssh-extended-regional-fungicides',
        $plugin_url . '/assets/extended-regional-fungicides.js',
        array(),
        time(),
        true
    );

    // ========================================
    // EUROPEAN REGIONAL FUNGICIDES v1.0.0
    // France (ANSES), Spain (MAPA), Germany (BVL §17)
    // Must load BEFORE disease-engine.js
    // ========================================
    wp_enqueue_script(
        'gssh-european-regional-fungicides',
        $plugin_url . '/assets/european-regional-fungicides.js',
        array(),
        time(),
        true
    );

    // ========================================
    // NZ FUNGICIDE DATABASE v1.0.0
    // ACVM/MPI registered active ingredients for New Zealand turf
    // Includes NZSTI bowls guide rates, FRAC groups, disease targets
    // Must load BEFORE fungicide-filter.js
    // ========================================
    wp_enqueue_script(
        'gssh-nz-fungicides',
        $plugin_url . '/assets/nz-fungicides.js',
        array(),
        time(),
        true
    );

    // ========================================
    // AU FUNGICIDE DATABASE v1.0.0
    // APVMA-registered products. Shared with GAIP.
    // Must load BEFORE fungicide-filter.js.
    // ========================================
    wp_enqueue_script(
        'gssh-au-fungicides',
        $plugin_url . '/assets/au-fungicides.js',
        array(),
        time(),
        true
    );

    // ========================================
    // UK FUNGICIDE DATABASE v1.0.0
    // HSE CRD MAPP register. Shared with GAIP.
    // Must load BEFORE fungicide-filter.js.
    // ========================================
    wp_enqueue_script(
        'gssh-uk-fungicides',
        $plugin_url . '/assets/uk-fungicides.js',
        array(),
        time(),
        true
    );

    // ========================================
    // UNIFIED FUNGICIDE FILTER SERVICE v1.0.0
    // Routes fungicide queries to correct regional database
    // Separates AU (APVMA) from NZ (ACVM) based on coordinates
    // Must load AFTER all regional fungicide databases
    // ========================================
    wp_enqueue_script(
        'gssh-fungicide-filter',
        $plugin_url . '/assets/fungicide-filter.js',
        array('gssh-regional-profiles', 'gssh-nz-fungicides', 'gssh-au-fungicides', 'gssh-uk-fungicides', 'gssh-extended-regional-fungicides', 'gssh-european-regional-fungicides'),
        time(),
        true
    );

    // ========================================
    // SMITH-KERNS DOLLAR SPOT MODEL v1.0.0
    // True implementation of Smith et al. (2018) PLOS ONE
    // 5-day rolling hourly RH/temp with 20% action threshold
    // Must load BEFORE disease-engine.js (provides DollarSpotModelV2)
    // ========================================
    wp_enqueue_script(
        'gssh-smith-kerns',
        $plugin_url . '/assets/smith-kerns-model.js',
        array('gssh-climate-engine'),
        time(),
        true
    );

    // ========================================
    // LARGE PATCH MODEL v1.0.0
    // Rhizoctonia solani AG 2-2 LP - warm-season (C4) turf only
    // Must load BEFORE disease-engine.js (provides LargePatchModel)
    // ========================================
    wp_enqueue_script(
        'gssh-large-patch',
        $plugin_url . '/assets/large-patch-model.js',
        array('gssh-climate-engine'),
        time(),
        true
    );

    // ========================================
    // DISEASE RISK ENGINE v2.10.0
    // Climate-driven disease prediction with REGIONAL PRESSURE MULTIPLIERS
    // Source: Smith-Kerns, Fidanza, Vargas, Smiley
    // v2.9.5: Added Waitea Patch model (NZ only), hemisphere-aware soil temp estimation
    // v2.10.0: Added Large Patch model for warm-season turf
    // ========================================
    wp_enqueue_script(
        'gssh-disease-engine',
        $plugin_url . '/assets/disease-engine.js',
        array('gssh-climate-engine', 'gssh-nitrogen-validator', 'gssh-regional-profiles', 'gssh-extended-regional-fungicides', 'gssh-european-regional-fungicides', 'gssh-fungicide-filter', 'gssh-smith-kerns', 'gssh-large-patch'),
        time(),
        true
    );

    // b35fix123: disease-engine-pure.js was missing from GSSH enqueue.
    // Legacy stub throws FATAL if DiseaseEnginePure is not loaded.
    // Must load AFTER disease-engine.js (which sets up the stub/shim).
    wp_enqueue_script(
        'gssh-disease-engine-pure',
        $plugin_url . '/assets/disease-engine-pure.js',
        array('gssh-disease-engine'),
        gilba_asset_version( 'assets/disease-engine-pure.js' ),
        true
    );
    wp_add_inline_script( 'gssh-disease-engine-pure',
        'window.GILBA_USE_PURE_DISEASE = true;',
        'before'
    );

    // ========================================
    // DISEASE ↔ STRESS/CLIMATE COUPLING v1.0.0
    // Reduces false positives by factoring stress state and climate context
    // into disease risk calculations. Post-processes DiseaseEngine output.
    // Must load after disease-engine, consumed by hub-orchestrator.
    // ========================================
    wp_enqueue_script(
        'gssh-disease-stress-coupling',
        $plugin_url . '/assets/disease-stress-climate-coupling.js',
        array('gssh-disease-engine'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-disease-ui',
        $plugin_url . '/assets/disease-ui.js',
        array('gssh-disease-engine'),
        time(),
        true
    );

    wp_enqueue_style(
        'gssh-disease-ui-css',
        $plugin_url . '/assets/disease-ui.css',
        array('gssh-hub-css'),
        time()
    );

    wp_enqueue_script(
        'gssh-disease-integration',
        $plugin_url . '/assets/disease-integration.js',
        array('gssh-disease-engine', 'gssh-disease-ui', 'gssh-hub-js', 'gssh-fungicide-filter'),
        time(),
        true
    );

    // ========================================
    // LEAF SPOT MODELS v2.1 (BETA)
    // Species-specific disease models replacing generic Helminthosporium
    // Warm-season: B. cynodontis, B. sorokiniana, Curvularia spp.
    // Cool-season: Drechslera poae (KBG melting-out)
    // NEW: Co-infection synergy (B. sorokiniana + Curvularia)
    // Source: Brecht et al. 2007, PSU Turfgrass Lab, UMass Extension
    // ========================================
    wp_enqueue_script(
        'gssh-bipolaris-curvularia',
        $plugin_url . '/assets/bipolaris-curvularia-models.js',
        array('gssh-disease-engine', 'gssh-disease-engine-pure', 'gssh-disease-integration'),
        time(),
        true
    );

    // ========================================
    // RED THREAD MODEL v1.0.0
    // Heuristic risk index for Laetisaria fuciformis
    // Valid globally for cool-season turf (UK, Europe, NZ, Australia, North America)
    // NOT a validated predictive model - uses observational thresholds
    // Key insight: Nitrogen deficiency is the primary driver
    // Source: Penn State, NC State, MSU, Syngenta ANZ, RHS UK, Smiley et al.
    // ========================================
    wp_enqueue_script(
        'gssh-red-thread-model',
        $plugin_url . '/assets/red-thread-model.js',
        array('gssh-disease-engine'),
        time(),
        true
    );

    // Red Thread Integration - wires model into disease forecast and UI
    wp_enqueue_script(
        'gssh-red-thread-integration',
        $plugin_url . '/assets/red-thread-integration.js',
        array('gssh-red-thread-model', 'gssh-disease-integration'),
        time(),
        true
    );

    // gssh-charts.js deleted — identical to gilba-charts.js; GSSH scripts depend on 'gaip-charts' handle below.

    // ========================================
    // DISEASE FORECAST v1.3
    // Daily disease risk forecast for timeline chart
    // v1.3: Consecutive day multiplier + soil temp estimate
    // v1.4: Respects effective species when overseed is dominant
    // v1.4.1: Fix stale species after switching turf types
    // v2.0: GAIP physics-based soil temp integration
    // v2.1: Red thread model integration for UK/Europe/NZ/AU
    // ========================================
    wp_enqueue_script(
        'gssh-disease-forecast',
        $plugin_url . '/assets/disease-forecast.js',
        array('gaip-charts', 'gssh-disease-engine', 'gssh-red-thread-integration', 'gssh-species-controller'),
        time(),
        true
    );

    // ========================================
    // IRRIGATION FORECAST v1.0
    // Water balance timeline chart
    // ========================================
    wp_enqueue_script(
        'gssh-irrigation-forecast',
        $plugin_url . '/assets/irrigation-forecast.js',
        array('gaip-charts', 'gssh-irrigation-scheduler'),
        time(),
        true
    );
    // ========================================

    // ========================================
    // SHADE FORECAST v1.0.0
    // Seasonal DLI trajectory chart
    // ========================================
    wp_enqueue_script(
        'gssh-shade-forecast',
        $plugin_url . '/assets/shade-forecast.js',
        array('gaip-charts', 'gssh-shade-engine'),
        time(),
        true
    );

    // ========================================
    // PGR FORECAST v1.0.1
    // GDD decay timeline chart
    // ========================================
    wp_enqueue_script(
        'gssh-pgr-forecast',
        $plugin_url . '/assets/pgr-forecast.js',
        array('gaip-charts', 'gssh-pgr-module'),
        time(),
        true
    );

    // ========================================
    // STRESS TRAJECTORY ENGINE v2.0.0
    // True time-series stress projection (14-day default, up to 28)
    // Integrates: Water | Light | Temperature | Nutrition | Traffic | Disease
    // Compound effects when multiple stressors > 35%
    // Source: Gilba Solutions methodology integrating:
    //   - Thermal: PACE Turf GP model (C3/C4 optimal ranges)
    //   - Light: Wherley et al. (2005), Trappe et al. (2011) - DLI recovery
    //   - Moisture: FAO-56 ET balance, Carrow & Duncan (1998)
    //   - Traffic: Baker/Gibbs STRI (1989), GMA UK
    //   - Nutrition: Kussow et al., PACE Turf N response
    //   - Biotic: Smith-Kerns, Fidanza, Vargas disease models
    // ========================================
    wp_enqueue_script(
        'gssh-stress-trajectory-engine',
        $plugin_url . '/assets/stress-trajectory-engine-pure.js',
        array('gssh-climate-engine', 'gssh-disease-engine', 'gssh-dli-recovery-bridge', 'gssh-wear-recovery-engine'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-stress-trajectory-ui',
        $plugin_url . '/assets/stress-trajectory-ui.js',
        array('gssh-stress-trajectory-engine'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-stress-trajectory-integration',
        $plugin_url . '/assets/stress-trajectory-integration.js',
        array('gssh-stress-trajectory-engine', 'gssh-stress-trajectory-ui', 'gssh-hub-js'),
        time(),
        true
    );

    // ========================================
    // HUB INTEGRATION PATCH v1.0.0
    // Wires DLI-Recovery Bridge and Stress Trajectory into hub pipeline
    // - Enhances shadeData with DLI recovery modifiers before wear-recovery
    // - Adds stress trajectory projection after all modules complete
    // - Provides rendering helpers for UI integration
    // ========================================
    wp_enqueue_script(
        'gssh-hub-integration-patch',
        $plugin_url . '/assets/hub-integration-patch.js',
        array('gssh-dli-recovery-bridge', 'gssh-stress-trajectory-engine', 'gssh-wear-recovery-engine', 'gssh-hub-js'),
        time(),
        true
    );

    // ========================================
    // DEPENDENCY GRAPH v1.0.0
    // Must load BEFORE hub-orchestrator and scenario engine
    // Formalizes engine dependencies as a DAG for selective recomputation
    // ========================================
    wp_enqueue_script(
        'gssh-dependency-graph',
        $plugin_url . '/assets/dependency-graph.js',
        array(),  // No dependencies - standalone graph definition
        time(),
        true
    );

    // ========================================
    // SOIL TEMPERATURE LOGGER v1.0.0
    // Stores daily soil temp per site in localStorage.
    // Feeds GAIP_SoilTempLogger.getHistory() into buildPreEmergentInputs()
    // so the pre-emergent trend engine has real measured history.
    // Fires on gaip:orchestrator-complete — one entry per site per day.
    // ========================================
    wp_enqueue_script(
        'gssh-soil-temp-logger',
        $plugin_url . '/assets/soil-temp-logger.js',
        array('gssh-hub-js'),
        time(),
        true
    );

    // ========================================
    // PRE-EMERGENT TIMING ENGINE v1.1.0
    // Pure function engine — soil temp thresholds vs germination data.
    // Covers AU/NZ temperate + tropical weed suites (v1.1.0).
    // Must load BEFORE hub-orchestrator (consumed in computeAll step 8b).
    // Sources: Fidanza et al. (1996); Teuton et al. (2004); Chauhan et al. (2008)
    // ========================================
    wp_enqueue_script(
        'gssh-pre-emergent-engine',
        $plugin_url . '/assets/pre-emergent-engine.js',
        array('gssh-climate-engine'),
        time(),
        true
    );

    // ========================================
    // PRE-EMERGENT INTEGRATION & UI v1.1.0
    // Renders timing card from GAIP_PRE_EMERGENT_RESULT after orchestrator runs.
    // ========================================
    wp_enqueue_script(
        'gssh-pre-emergent-integration',
        $plugin_url . '/assets/pre-emergent-integration.js',
        array('gssh-pre-emergent-engine', 'gssh-hub-orchestrator'),
        time(),
        true
    );

    // ========================================
    // HUB ORCHESTRATOR v1.0.0
    // Central module wiring and dependency resolution
    // Enforces causality between engine outputs:
    // - Salinity → recovery penalty
    // - Shade → recovery + disease
    // - Dew duration → disease risk
    // - Stress aggregation → compound effects
    // v1.5.0: Tiered identity enforcement - hard fail species, soft default others
    // ========================================
    wp_enqueue_script(
        'gssh-hub-orchestrator',
        $plugin_url . '/assets/hub-orchestrator.js',
        array(
            'gaip-utils',
            'gssh-species-controller',
            'gssh-identity-enforcement',  // v1.5.0: Must load before orchestrator
            'gssh-climate-engine',
            'gssh-shade-engine',
            'gssh-salinity-penalty',
            'gssh-wear-recovery-engine',
            'gssh-dew-prediction-engine',
            'gssh-disease-engine',
            'gssh-pre-emergent-engine',   // v1.1.0: Pre-emergent timing engine (step 8b)
            'gssh-soil-temp-logger',      // v1.0.0: Soil temp history for trend analysis
            'gssh-hub-js',
            'gssh-dependency-graph'
        ),
        time(),
        true
    );

    // ========================================
    // PHASE 1 EPISTEMIC INFRASTRUCTURE
    // Citation registry, contradiction detection, export metadata
    // ========================================
    
    // Citation Registry v1.0.0
    // Provides formal provenance tracking for all engine outputs
    wp_enqueue_script(
        'gssh-citation-registry',
        $plugin_url . '/assets/citation-registry.js',
        array('gssh-hub-orchestrator'),
        time(),
        true
    );
    
    // Engine Confidence v2.0.0
    // Standardizes applicability and confidence assessment across all engines
    // v2.0: Input completeness, confidence accumulation, forecast degradation
    wp_enqueue_script(
        'gssh-engine-confidence',
        $plugin_url . '/assets/engine-confidence.js',
        array('gssh-hub-orchestrator', 'gssh-citation-registry'),
        time(),
        true
    );
    
    // Confidence UI Integration v1.0.1
    // Displays confidence badges and warnings in the Hub UI
    // v1.0.1: Fixed TypeError when warnings array is undefined
    wp_enqueue_script(
        'gssh-confidence-ui',
        $plugin_url . '/assets/confidence-ui-integration.js',
        array('gssh-engine-confidence', 'gssh-hub-orchestrator'),
        time(),
        true
    );
    
    // Contradiction Detector v1.0.0
    // Meta-engine oversight for internal consistency checks
    wp_enqueue_script(
        'gssh-contradiction-detector',
        $plugin_url . '/assets/contradiction-detector.js',
        array('gssh-hub-orchestrator', 'gssh-citation-registry'),
        time(),
        true
    );
    
    // Input Range Validator v1.0.0
    // Validates soil/water/tissue values against expected agronomic ranges
    // Advisory warnings only - catches garbage-in scenarios
    wp_enqueue_script(
        'gssh-input-validator',
        $plugin_url . '/assets/input-range-validator.js',
        array('gssh-hub-js'),
        time(),
        true
    );
    
      // ========================================
    // SCENARIO ENGINE + COMPARISON UI (Phase 2)
    // ========================================
    
    // Scenario Engine v2.0.3
    // Pure state-based calculations - bypasses DOM-reading global engines
    // Integrated: Water, Disease, Shade, Traffic, PGR, Irrigation, N-Opt, Stress
    wp_enqueue_script(
        'gssh-scenario-engine',
        $plugin_url . '/assets/gssh-scenario-engine.js',
        array('gssh-hub-orchestrator', 'gssh-engine-confidence', 'gssh-dependency-graph'),
        time(),
        true
    );
    
    // Scenario Comparison UI v2.6.2
    // Word Export Integration - wires up GilbaScenarioExport.prepare()
    // Species comparison presets: Kikuyu, Couch, Ryegrass, Zoysia, Buffalo
    // Displays all engine results with delta comparison
    wp_enqueue_script(
        'gssh-scenario-ui',
        $plugin_url . '/assets/gssh-whatif-ui.js',
        array('gssh-scenario-engine', 'gssh-engine-confidence', 'gssh-dependency-graph'),
        time(),
        true
    );

    // ========================================
    // CASCADE ORCHESTRATOR + SCENARIO PRESETS (Stage 2-4)
    // Dependency-aware engine execution and preset scenarios
    // ========================================
    
    // Cascade Orchestrator v1.3.0 (SSOT Adapter)
    // Provides GilbaCascadeOrchestrator.runCascade() interface
    // v1.1.0: Added soil-structure-engine integration (Stage 2.5)
    // v1.2.0: Added stress-trajectory-engine (Stage 6)
    // v1.3.0: Added phytotoxicity-engine (Stage 2.6)
    // Must load BEFORE hub-tissue-v3.js
    // Note: phytotoxicity-engine loads via water-progressive chain, not as direct dependency
    wp_enqueue_script(
        'gssh-cascade-orchestrator',
        $plugin_url . '/assets/cascade-orchestrator.js',
        array('gssh-dependency-graph'),
        time(),
        true
    );
    
    // Prediction Logger v1.0.0 (Phase 1 of Empirical Calibration)
    // Passively observes cascade completions and logs predictions for outcome tracking
    // Subscribes to gssh:cascade-complete event, writes to wp_gilba_predictions
    wp_enqueue_script(
        'gssh-prediction-logger',
        $plugin_url . '/assets/prediction-logger.js',
        array('gssh-cascade-orchestrator'),
        time(),
        true
    );
    
    // Outcome Capture UI v1.0.0 (Phase 2 of Empirical Calibration)
    // Surfaces ripe predictions for superintendent review, writes outcomes via REST
    // Renders in Today tab above daily dashboard
    wp_enqueue_script(
        'gssh-outcome-capture-ui',
        $plugin_url . '/assets/outcome-capture-ui.js',
        array('gssh-prediction-logger', 'gssh-tab-navigation'),
        time(),
        true
    );
    
    // Scenario Presets v1.0.0
    // Pre-configured what-if scenarios: Gypsum, MLSN/SLAN, Water Blending
    wp_enqueue_script(
        'gssh-scenario-presets',
        $plugin_url . '/assets/scenario-presets.js',
        array('gssh-cascade-orchestrator'),
        time(),
        true
    );
    
    // Scenario Export v1.0.0
    // Formats scenario comparisons for Word export with confidence scoring
    wp_enqueue_script(
        'gssh-scenario-export',
        $plugin_url . '/assets/scenario-export.js',
        array('gssh-scenario-presets'),
        time(),
        true
    );
    
    // Word Export Scenario Patch v1.2.0
    // Integrates scenario data into Word export
    // v1.2.0: Actually renders scenario section into document (patches buildSections)
    wp_enqueue_script(
        'gssh-word-export-patch',
        $plugin_url . '/assets/word-export-scenario-patch.js',
        array('gssh-word-export', 'gssh-scenario-export'),
        time(),
        true
    );

    // ========================================
    // SpecConnect API Adapter (TDR 350/300 live data)
    wp_enqueue_script(
        'gssh-specconnect',
        $plugin_url . '/assets/sensor-api-specconnect.js',
        array('gssh-hub-js', 'gssh-sensor-api-bridge'),
        gilba_asset_version( 'assets/sensor-api-specconnect.js' ),
        true
    );

    // SENSOR IMPORT MODULE (TDR 350 + POGO support)
    // ========================================
    wp_enqueue_style(
        'gssh-sensor-css',
        $plugin_url . '/assets/sensor-import.css',
        array(),
        time()
    );
    
    wp_enqueue_script(
        'gssh-sensor-import',
        $plugin_url . '/assets/sensor-import.js',
        array(),
        time(),
        true
    );
    
    wp_enqueue_script(
        'gssh-sensor-ui',
        $plugin_url . '/assets/sensor-import-ui.js',
        array('gssh-sensor-import'),
        time(),
        true
    );
    
    // ========================================
    // LIVE SENSOR API INTEGRATIONS
    // Multi-vendor sensor support with per-user credentials
    // and site-to-sensor mapping
    // ========================================
    
    // Sensor Integration Manager v1.0.0
    // Central coordinator for all sensor vendors
    // Handles credentials, site mapping, data aggregation
    wp_enqueue_script(
        'gssh-sensor-manager',
        $plugin_url . '/assets/sensor-integration-manager.js',
        array('gssh-sensor-import'),
        time(),
        true
    );
    
    // Hydrosight Vendor Adapter v1.2.0
    // Registers with SensorManager, handles Hydrosight API
    wp_enqueue_script(
        'gssh-sensor-api-hydrosight',
        $plugin_url . '/assets/sensor-api-hydrosight.js',
        array('gssh-sensor-manager'),
        time(),
        true
    );
    
    // Sensor API Bridge v1.0.0
    // Patches GSSH_Sensor for live data priority
    wp_enqueue_script(
        'gssh-sensor-api-bridge',
        $plugin_url . '/assets/sensor-api-bridge.js',
        array('gssh-sensor-manager', 'gssh-sensor-api-hydrosight'),
        time(),
        true
    );
    
    // Sensor Integration UI v1.0.0
    // Settings panel, site-sensor mapping modal
    wp_enqueue_script(
        'gssh-sensor-settings-ui',
        $plugin_url . '/assets/sensor-integration-ui.js',
        array('gssh-sensor-manager', 'gssh-sensor-api-hydrosight'),
        time(),
        true
    );
    
    // ========================================
    // LAB DATA IMPORT MODULE (CSV)
    // ========================================
    // Lab Import v1.1.0 - Schema validation
    // Validates CSV headers and value ranges at import time
    // ========================================
    wp_enqueue_script(
        'gssh-lab-import',
        $plugin_url . '/assets/lab-import.js',
        array(),
        time(),
        true
    );
    
    // ========================================
    // MULTI-SAMPLE MANAGER v1.0
    // Supports multiple soil, water, tissue samples
    // Import from CSV/XLSX or manual entry
    // ========================================
    wp_enqueue_script(
        'gssh-sample-manager',
        $plugin_url . '/assets/sample-manager.js',
        array('gssh-lab-import'),
        time(),
        true
    );
    
    // v1.0.0: Combined multi-site Word export (one document for all samples)
    // b35fix302b: depends on gilba-nutrition-requirement-engine (Task 11 rewire).
    wp_enqueue_script(
        'gssh-word-export-combined',
        $plugin_url . '/assets/word-export-combined.js',
        array('gssh-word-export', 'gssh-sample-manager', 'gilba-nutrition-requirement-engine'),
        time(),
        true
    );
    
    wp_enqueue_script(
        'gssh-sample-switcher-ui',
        $plugin_url . '/assets/sample-switcher-ui.js',
        array('gssh-sample-manager'),
        time(),
        true
    );
    
    // Form UX v1.0 - collapsible sections (irrigation system, soil water status, sensor import)
    // b35fix181: was missing from GSSH enqueue — all three optional accordions were dead
    wp_enqueue_script(
        'gssh-form-ux',
        $plugin_url . '/assets/form-ux.js',
        array(),
        gilba_asset_version( 'assets/form-ux.js' ),
        true
    );

    // Clear Data Module - clear/reset buttons for soil, water, tissue panels
    wp_enqueue_script(
        'gssh-clear-data',
        $plugin_url . '/assets/gssh-clear-data.js',
        array('gssh-sample-manager'),
        time(),
        true
    );
    
    // Input State Watcher - detects stale results after input changes
    // Part of TIER 2 #4: Scenario-Aware Recalculation Cascade
    wp_enqueue_script(
        'gssh-input-watcher',
        $plugin_url . '/assets/input-state-watcher.js',
        array('gssh-hub-js', 'gssh-sample-manager'),
        time(),
        true
    );
    
    // Soil Structure Engine - Water → Soil Structure Assessment
    // Part of TIER 2 #6: Two-pathway model (clay/sand)
    // v2.0.2: Fixed species extraction (grassSpecies not variety)
    wp_enqueue_script(
        'gssh-soil-structure',
        $plugin_url . '/assets/soil-structure-engine.js',
        array('gaip-utils', 'gssh-species-controller', 'gssh-water-blender', 'gssh-salinity-penalty'),
        time(),
        true
    );
    
    wp_enqueue_style(
        'gssh-sample-manager-css',
        $plugin_url . '/assets/sample-manager.css',
        array('gssh-hub-css'),
        time()
    );
    
    // Site Selector UI - multi-site management for consultants
    wp_enqueue_script(
        'gssh-site-selector-ui',
        $plugin_url . '/assets/site-selector-ui.js',
        array('gssh-sample-manager'),
        time(),
        true
    );
    
    // Site Config Persistence - saves/restores turf profile per site on switch
    wp_enqueue_script(
        'gssh-site-config',
        $plugin_url . '/assets/site-config-persistence.js',
        array('gssh-sample-manager', 'gssh-site-selector-ui'),
        time(),
        true
    );
    
    wp_enqueue_style(
        'gssh-site-selector-css',
        $plugin_url . '/assets/site-selector-ui.css',
        array('gssh-hub-css'),
        time()
    );
    
    // ========================================
    // NUTRIENT TREND TRACKING v1.0
    // Temporal trend analysis per zone with MLSN threshold crossing alerts
    // ========================================
    wp_enqueue_script(
        'gssh-nutrient-trend',
        $plugin_url . '/assets/nutrient-trend.js',
        array('gssh-sample-manager', 'gssh-mlsn-progressive', 'gssh-nutrient-demand'),
        time(),
        true
    );
    
    wp_enqueue_style(
        'gssh-nutrient-trend-css',
        $plugin_url . '/assets/nutrient-trend.css',
        array('gssh-mlsn-progressive-css'),
        time()
    );
    
    // ========================================
    // WORD EXPORT v2.0
    // Export to .docx format
    // ========================================
    
    // JSZip 3.10.1 — local copy (eliminates CDN dependency on cdnjs.cloudflare.com)
    wp_enqueue_script(
        'gssh-jszip',
        $plugin_url . '/assets/jszip.min.js',
        array(),
        '3.10.1',
        true
    );
    
    wp_enqueue_script(
        'gssh-docx-lib',
        $plugin_url . '/assets/docx.min.js',
        array('gssh-jszip'),
        time(),
        true
    );
    
    wp_enqueue_script(
        'gssh-word-export',
        $plugin_url . '/assets/word-export.js',
        array('gssh-docx-lib', 'gssh-hub-js', 'gssh-jszip', 'gssh-fungicide-filter', 'gssh-nutrient-trend', 'gilba-nutrition-requirement-engine'),
        time(),
        true
    );
    
    // Export Metadata v1.0.0
    // Adds version stamps, citations, and provenance to exports
    wp_enqueue_script(
        'gssh-export-metadata',
        $plugin_url . '/assets/export-metadata.js',
        array('gssh-word-export', 'gssh-citation-registry', 'gssh-contradiction-detector'),
        time(),
        true
    );
    
    // ========================================
    // AI INTERPRETATION v1.0.0
    // Claude-powered soil analysis interpretation
    // Supports MLSN, SLAN, Ammonium Acetate (Hill Labs NZ)
    // ========================================
    // gssh-soil-interpretation.js deleted — namespace-rename-only fork of gilba-soil-interpretation.js.
    wp_enqueue_script(
        'gssh-soil-interpretation',
        $plugin_url . '/assets/gilba-soil-interpretation.js',
        array('gssh-hub-js', 'gssh-mlsn-progressive'),
        time(),
        true
    );
    
    // Water Quality AI Interpretation
    // gssh-water-interpretation.js deleted — namespace-rename-only fork of gilba-water-interpretation.js.
    wp_enqueue_script(
        'gssh-water-interpretation',
        $plugin_url . '/assets/gilba-water-interpretation.js',
        array('gssh-hub-js'),
        time(),
        true
    );
    
    // Cross-Module Synthesis Interpretation
    // gssh-synthesis-interpretation.js deleted — namespace-rename-only fork of gilba-synthesis-interpretation.js.
    wp_enqueue_script(
        'gssh-synthesis-interpretation',
        $plugin_url . '/assets/gilba-synthesis-interpretation.js',
        array('gssh-hub-js'),
        time(),
        true
    );
    
    wp_enqueue_style(
        'gssh-interpretation-css',
        $plugin_url . '/assets/gilba-interpretation.css',
        array('gssh-hub-css'),
        time()
    );
    // ========================================

    // ========================================
    // HUB PERSISTENCE v1.0.0
    // localStorage persistence for input state, samples, and preferences
    // Auto-saves on changes, restores on page load
    // ========================================
    wp_enqueue_script(
        'gssh-hub-persistence',
        $plugin_url . '/assets/hub-persistence.js',
        // b35fix273: gssh-site-config must load before hub-persistence
        array('gssh-hub-js', 'gssh-turf-profile-controller', 'gssh-hub-orchestrator', 'gssh-site-config'),
        time(),
        true
    );

    // ========================================
    // DAILY DASHBOARD v1.0.0
    // At-a-glance dashboard with key turf management metrics
    // Growth potential, disease risk, stress, weather, irrigation, actions
    // ========================================
    wp_enqueue_script(
        'gssh-daily-dashboard',
        $plugin_url . '/assets/daily-dashboard.js',
        array('gssh-hub-js', 'gssh-hub-persistence', 'gssh-climate-engine', 'gssh-species-controller'),
        time(),
        true
    );

    // ========================================
    // PRIORITY ACTION QUEUE v1.0.0
    // Sits between Daily Dashboard scorecards and module panels.
    // Reads from SSOT canonical state — no engine changes required.
    // Renders urgency-sorted action items from all engines.
    // ========================================
    wp_enqueue_script(
        'gssh-priority-queue',
        $plugin_url . '/assets/priority-action-queue.js',
        array('gssh-hub-js', 'gssh-daily-dashboard'),
        time(),
        true
    );
    wp_enqueue_style(
        'gssh-priority-queue',
        $plugin_url . '/assets/priority-action-queue.css',
        array(),
        time()
    );

    // ========================================
    // DECISION STATE MACHINE v1.0.0 (b35fix219)
    // ========================================
    wp_enqueue_style(
        'gssh-decision-css',
        $plugin_url . '/assets/gaip-decision.css',
        array(),
        gilba_asset_version( 'assets/gaip-decision.css' )
    );

    wp_enqueue_script(
        'gssh-decision-engine',
        $plugin_url . '/assets/gaip-decision-engine.js',
        array( 'gssh-hub-js', 'gilba-storage-ns', 'gssh-priority-queue' ),
        gilba_asset_version( 'assets/gaip-decision-engine.js' ),
        true
    );

    wp_enqueue_script(
        'gssh-decision-ui',
        $plugin_url . '/assets/gaip-decision-ui.js',
        array( 'gssh-decision-engine', 'gssh-hub-orchestrator' ),
        gilba_asset_version( 'assets/gaip-decision-ui.js' ),
        true
    );

    // ========================================
    // FLOATING RUN BUTTON v1.0.0
    // Fixed-position "Update" FAB for quick access to Run Analysis
    // Keyboard shortcut: Ctrl+Enter (Cmd+Enter on Mac)
    // Auto-hides when original button is in viewport
    // ========================================
    wp_enqueue_script(
        'gssh-floating-run-button',
        $plugin_url . '/assets/floating-run-button.js',
        array('gssh-hub-js'),
        time(),
        true
    );
    // ========================================

    // ========================================
    // AUTO-REFRESH v1.0.0
    // For returning users, auto-runs analysis on page load
    // so dashboard shows live climate-driven data immediately.
    // Waits for persistence restore, then triggers run button.
    // ========================================
    wp_enqueue_script(
        'gssh-auto-refresh',
        $plugin_url . '/assets/auto-refresh.js',
        array('gssh-hub-js', 'gssh-hub-persistence', 'gssh-daily-dashboard', 'gssh-floating-run-button', 'gssh-site-setup-wizard'),
        time(),
        true
    );

    // ========================================
    // CARD LAYOUT REDESIGN v1.0.0
    // Phase 3: Progressive disclosure card layout.
    // Results as collapsible cards, inputs collapsed by default.
    // Pure DOM restructuring — no PHP changes to result blocks.
    // ========================================
    wp_enqueue_script(
        'gssh-card-layout-redesign',
        $plugin_url . '/assets/card-layout-redesign.js',
        array('gssh-hub-js', 'gssh-daily-dashboard', 'gssh-auto-refresh'),
        time(),
        true
    );

    // ========================================
    // TAB NAVIGATION v1.0.0
    // Phase 4: Today / Analysis / Programmes / Reports tabs.
    // Shows/hides groups of existing cards — no DOM destruction.
    // ========================================
    wp_enqueue_script(
        'gssh-tab-navigation',
        $plugin_url . '/assets/tab-navigation.js',
        array('gssh-hub-header-bar', 'gssh-daily-dashboard', 'gssh-card-layout-redesign'),
        time(),
        true
    );

    // ========================================
    // NUTRITION CALENDAR MODULE v1.0.0
    // GP-weighted nutrient distribution calendar with MLSN/SLAN methodology
    // ========================================
    wp_enqueue_script(
        'gssh-nutrition-calendar',
        $plugin_url . '/assets/nutrition-calendar.js',
        array('gssh-hub-js', 'gssh-nutrition-summary', 'gssh-climate-v2'),
        time(),
        true
    );

    wp_enqueue_style(
        'gssh-nutrition-calendar-css',
        $plugin_url . '/assets/nutrition-calendar.css',
        array('gssh-hub-css'),
        time()
    );

    // ========================================
    // REGIONAL FERTILISER PRODUCTS — Conditional loading
    // Only enqueue AU/NZ fertiliser databases for their respective regions.
    // Saves ~383 KB for non-AU/NZ users, ~156-227 KB for AU or NZ users.
    // Falls back to loading everything if no saved location.
    // ========================================
    $location_manager_pre = Gilba_Location_Manager::get_instance();
    $loc_pre = $location_manager_pre->get_saved_location();
    $user_lat = isset($loc_pre['lat']) ? floatval($loc_pre['lat']) : null;
    $user_lon = isset($loc_pre['lon']) ? floatval($loc_pre['lon']) : (isset($loc_pre['lng']) ? floatval($loc_pre['lng']) : null);

    // Detect region from coordinates
    $is_au = ($user_lat < 0 && $user_lon >= 110 && $user_lon <= 155);
    $is_nz = ($user_lat < 0 && $user_lon >= 165 && $user_lon <= 180);

    if ($is_nz) {
        wp_enqueue_script(
            'gssh-prebbles-products',
            $plugin_url . '/assets/prebbles-products.js',
            array('gssh-nutrition-calendar'),
            time(),
            true
        );

        wp_enqueue_script(
            'gssh-nutrition-prebble-integration',
            $plugin_url . '/assets/nutrition-prebble-integration.js',
            array('gssh-nutrition-calendar', 'gssh-prebbles-products'),
            time(),
            true
        );
    }

    if ($is_au) {
        wp_enqueue_script(
            'gssh-au-fertiliser-products',
            $plugin_url . '/assets/au-fertiliser-products.js',
            array('gssh-nutrition-calendar'),
            time(),
            true
        );

        wp_enqueue_script(
            'gssh-nutrition-au-fertiliser-integration',
            $plugin_url . '/assets/nutrition-au-fertiliser-integration.js',
            array('gssh-nutrition-calendar', 'gssh-au-fertiliser-products', 'gssh-mlsn-progressive'),
            time(),
            true
        );
    }

    // b35fix293: UK fertiliser database + integration for GSSH
    // Loaded unconditionally — same rationale as GAIP enqueue.
    wp_enqueue_script(
        'gssh-uk-fertiliser-products',
        $plugin_url . '/assets/uk-fertiliser-products.js',
        array('gssh-nutrition-calendar'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-nutrition-uk-fertiliser-integration',
        $plugin_url . '/assets/nutrition-uk-fertiliser-integration.js',
        array('gssh-nutrition-calendar', 'gssh-uk-fertiliser-products', 'gssh-mlsn-progressive'),
        time(),
        true
    );

    // ========================================
    // TISSUE CORRECTIVE ENGINE v1.0.0
    // Generates foliar supplementation overlays on nutrition calendar
    // based on tissue test results cross-referenced with soil/water data.
    // Injects corrective rows into calendar for deficient/marginal nutrients.
    // ========================================
    wp_enqueue_script(
        'gssh-tissue-corrective-engine',
        $plugin_url . '/assets/tissue-corrective-engine-pure.js',
        array('gssh-nutrition-calendar', 'gssh-tissue-engine', 'gssh-hub-js'),
        time(),
        true
    );

    // Localize script with AJAX URL and saved location
    $location_manager = Gilba_Location_Manager::get_instance();
    $saved_location = $location_manager->get_saved_location();
    
    wp_localize_script(
        'gssh-hub-js',
        'GSSH_HUB_CONFIG',
        array(
            'openMeteoUrl' => 'https://api.open-meteo.com/v1/forecast',
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'restUrl' => rest_url('gssh/v1/'),
            'savedLocation' => $saved_location,
            'nonce' => wp_create_nonce('gssh_hub_nonce'),
            'restNonce' => wp_create_nonce('wp_rest'),
            'userId' => get_current_user_id(),
            'hubMode' => 'stadium',
        )
    );

    wp_localize_script(
        'gssh-hub-js',
        'GAIP_HUB_CONFIG',
        array(
            'openMeteoUrl' => 'https://api.open-meteo.com/v1/forecast',
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'restUrl' => rest_url('gilba/v1/'),
            'savedLocation' => $saved_location,
            'nonce' => wp_create_nonce('gilba_hub_nonce'), // b35fix97 — was gssh_hub_nonce; sensor AJAX handlers verify gilba_hub_nonce, causing 403 on cold load
            'restNonce' => wp_create_nonce('wp_rest'),
            'userId' => get_current_user_id(),
            'hubMode' => 'stadium',
        )
    );

    // ========================================
    // UNIFIED DESIGN SYSTEM v1.0
    // Must load LAST to override all module-specific styles
    // ========================================
    wp_enqueue_style(
        'gssh-design-system',
        $plugin_url . '/assets/gaip-design-system.css',
        array('gssh-hub-css'),
        time()
    );

    // ========================================
    // SITE SETUP WIZARD v1.0.0
    // First-run onboarding modal.
    // Loads after TurfProfile controller + regional profiles.
    // wp_localize_script passes first-run flag + saved location.
    // ========================================
    wp_enqueue_script(
        'gssh-site-setup-wizard',
        $plugin_url . '/assets/site-setup-wizard.js',
        array('gssh-turf-profile-controller', 'gssh-regional-profiles'),
        time(),
        true
    );

    wp_localize_script(
        'gssh-site-setup-wizard',
        'GSSH_WIZARD_CONFIG',
        array(
            'wizardComplete' => gilba_is_wizard_complete(),
            'savedLocation'  => $saved_location,
            'ajaxUrl'        => admin_url('admin-ajax.php'),
            'nonce'          => wp_create_nonce('gssh_hub_nonce'),
        )
    );

    // ========================================
    // HUB HEADER BAR v1.0.0
    // Sticky profile summary bar.
    // Phase 1 of UI redesign — pure addition.
    // ========================================
    wp_enqueue_script(
        'gssh-hub-header-bar',
        $plugin_url . '/assets/hub-header-bar.js',
        array('gssh-turf-profile-controller', 'gssh-regional-profiles'),
        time(),
        true
    );

    // ========================================
    // MOBILE TURF PROFILE BOTTOM SHEET v1.0.0
    // Floating FAB + bottom sheet for mobile
    // turf profile settings. Only activates
    // on screens ≤ 768px. No server deps.
    // ========================================
    wp_enqueue_script(
        'gssh-mobile-turf-sheet',
        $plugin_url . '/assets/mobile-turf-sheet.js',
        array('gssh-turf-profile-controller', 'gssh-hub-header-bar'),
        time(),
        true
    );

    // ========================================
    // GLOBAL SOLUBLES — b35fix265
    // Generic chemistry (MAP, urea, iron sulphate etc) available worldwide.
    // Loaded unconditionally so spray-log-ui.js buildNutritionOptions can
    // always access GAIP_AU_FERTILISER.products.soluble on UK/EU sites
    // where the full au-fertiliser-products.js is not enqueued.
    // If au-fertiliser-products.js is also loaded (AU sites), this is a no-op
    // because global-solubles.js checks for existing GAIP_AU_FERTILISER first.
    // ========================================
    wp_enqueue_script(
        'gssh-global-solubles',
        $plugin_url . '/assets/global-solubles.js',
        array(),
        gilba_asset_version( 'assets/global-solubles.js' ),
        true
    );

    // ========================================
    // SPRAY LOG v1.0.0
    // Application diary — REST client + UI.
    // Loads after sample manager (for site context).
    // ========================================
    wp_enqueue_script(
        'gssh-spray-log',
        $plugin_url . '/assets/spray-log.js',
        array('gssh-hub-js'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-spray-log-ui',
        $plugin_url . '/assets/spray-log-ui.js',
        array('gssh-spray-log', 'gssh-uv-residual', 'gssh-global-solubles'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-spray-log-integration',
        $plugin_url . '/assets/spray-log-integration.js',
        array('gssh-spray-log-ui', 'gssh-spray-log'),
        time(),
        true
    );

    wp_enqueue_script(
        'gssh-spray-log-cascade',
        $plugin_url . '/assets/spray-log-cascade.js',
        array('gssh-spray-log', 'gssh-spray-log-integration'),
        time(),
        true
    );

    // b35fix294: Printable spray log report for audit/compliance
    wp_enqueue_script(
        'gssh-spray-log-print',
        $plugin_url . '/assets/spray-log-print.js',
        array('gssh-spray-log', 'gssh-spray-log-ui'),
        time(),
        true
    );

    // ========================================
    // ALERTS — SMS/Email threshold notifications (b35fix107)
    // Shared with GAIP hub — same JS file, GSSH handle.
    // ========================================
    wp_enqueue_script(
        'gssh-alerts',
        $plugin_url . '/assets/gilba-alerts.js',
        array('gssh-hub-js', 'gssh-sample-manager'),
        gilba_asset_version( 'assets/gilba-alerts.js' ),
        true
    );

    // ========================================
    // UV PHOTOLYSIS FUNGICIDE RESIDUAL ENGINE v1.0.0 (GSSH)
    // Shared engine with GAIP — same file, different handle.
    // ========================================
    wp_enqueue_script(
        'gssh-uv-residual',
        $plugin_url . '/assets/uv-residual-engine.js',
        array('gssh-spray-log', 'gssh-climate-engine'),
        time(),
        true
    );

    // ========================================
    // SITE SETTINGS SLIDE-OVER PANEL v1.0.0
    // Phase 2 of UI redesign.
    // Slide-over panel replaces scroll-to-card.
    // Reads/writes same DOM elements as Turf Profile card.
    // ========================================
    wp_enqueue_script(
        'gssh-site-settings-panel',
        $plugin_url . '/assets/site-settings-panel.js',
        array('gssh-hub-header-bar', 'gssh-turf-profile-controller'),
        time(),
        true
    );

    // ========================================
    // STADIUM MODULE ASSETS
    // Shade orchestrator, venue selector, stadium tab UI
    // ========================================
    GSSH_Stadium_Loader::enqueue_assets( $plugin_url );
}

if ( GILBA_HUB_MODE === 'stadium' ) {
    add_action( 'wp_enqueue_scripts', 'gssh_hub_enqueue_stadium_assets' );
} else {
    // Also register when GILBA_HUB_MODE is 'agronomic' (default) but a specific page
    // uses [gaip_hub mode="stadium"]. The function itself gates on gilba_page_has_stadium_mode().
    add_action( 'wp_enqueue_scripts', 'gssh_hub_enqueue_stadium_assets' );
}

// ============================================
// STADIUM MODULE LOADER — AJAX HANDLERS
// Instantiated unconditionally so gssh_* AJAX actions are registered regardless
// of GILBA_HUB_MODE. Required when [gaip_hub mode="stadium"] shortcode is used
// on a page with GILBA_HUB_MODE === 'agronomic' (the default).
// AJAX handlers perform their own nonce validation — no security regression.
// ============================================
// (GSSH_HUB_VERSION and GSSH_REST_NAMESPACE are defined unconditionally near the top of this file)
// (class-gssh-prediction-logger, class-gssh-spray-log, class-gssh-stadium-loader
//  are require_once'd unconditionally near the top of this file)

// Instantiate GSSH_Stadium_Loader only when needed:
// - On GSSH AJAX requests (DOING_AJAX + action starts with 'gssh_')
// - On stadium-mode pages (GILBA_HUB_MODE === 'stadium' or mode="stadium" shortcode)
// This avoids loading the full stadium stack on every agronomic page load.
add_action('init', function() {
    $needs_gssh = false;

    if ( defined('DOING_AJAX') && DOING_AJAX ) {
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $action = isset( $_REQUEST['action'] ) ? sanitize_key( $_REQUEST['action'] ) : '';
        if ( strpos( $action, 'gssh_' ) === 0 ) {
            $needs_gssh = true;
        }
    }

    if ( ! $needs_gssh && GILBA_HUB_MODE === 'stadium' ) {
        $needs_gssh = true;
    }

    if ( ! $needs_gssh ) {
        global $post;
        if ( is_a( $post, 'WP_Post' ) && function_exists( 'gilba_page_has_stadium_mode' )
             && gilba_page_has_stadium_mode( $post ) ) {
            $needs_gssh = true;
        }
    }

    if ( $needs_gssh ) {
        GSSH_Stadium_Loader::get_instance();
    }
});

if ( GILBA_HUB_MODE === 'stadium' ) {

// Register activation hook for database table creation
register_activation_hook(__FILE__, array('Gilba_Prediction_Logger', 'activate'));
register_activation_hook(__FILE__, array('Gilba_Prediction_Logger', 'schedule_cron_jobs'));
register_deactivation_hook(__FILE__, array('Gilba_Prediction_Logger', 'clear_cron_jobs'));

// Spray log table creation
register_activation_hook(__FILE__, array('Gilba_Spray_Log', 'activate'));

// b35fix301b2 — Data layer foundation (stadium-mode activation symmetry)
register_activation_hook(__FILE__, array('Gilba_Data_Schema', 'activate'));

// ============================================
// LOCATION MANAGER CLASS
// ============================================
class GSSH_Location_Manager {

    const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';

    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('wp_ajax_gssh_save_location', array($this, 'ajax_save_location'));
        add_action('wp_ajax_gssh_geocode_search', array($this, 'ajax_geocode_search'));
        add_action('wp_ajax_nopriv_gssh_geocode_search', array($this, 'ajax_geocode_search'));
        add_action('wp_ajax_gssh_reverse_geocode', array($this, 'ajax_reverse_geocode'));
    }
    
    /**
     * Geocode address to coordinates using Nominatim (OpenStreetMap)
     */
    public function geocode_address($address) {
        $cache_key = 'gssh_geocode_' . md5($address);
        $cached = get_transient($cache_key);
        
        if ($cached !== false) {
            return $cached;
        }
        
        $headers = array('User-Agent' => 'Gilba Agronomic Hub WordPress Plugin/1.0');
        $timeout = array('timeout' => 10, 'headers' => $headers);
        
        // Strategy 1: Exact query as entered
        $results = $this->nominatim_search($address, $timeout);
        
        // Strategy 2: If no results, try with country codes for target markets
        // Nominatim struggles with "Business Name, Street" - adding country bias helps
        if (empty($results)) {
            $country_codes = 'au,nz,gb,us,jp,ie,de,fr,dk,se,no,fi';
            $results = $this->nominatim_search($address, $timeout, $country_codes);
        }
        
        // Strategy 3: If still nothing, strip street/drive/road qualifiers and retry
        // "Federal Golf Club, Gowrie Drive" → "Federal Golf Club"
        if (empty($results)) {
            $simplified = $this->simplify_query($address);
            if ($simplified !== $address) {
                $results = $this->nominatim_search($simplified, $timeout);
            }
        }
        
        // Strategy 4: Try as structured query - split on comma into amenity + location
        if (empty($results)) {
            $parts = array_map('trim', explode(',', $address));
            if (count($parts) >= 2) {
                // First part as amenity/name, rest as location context
                $amenity = urlencode($parts[0]);
                $location_parts = array_slice($parts, 1);
                $location_str = urlencode(implode(', ', $location_parts));
                $url = self::NOMINATIM_BASE_URL . "?amenity={$amenity}&street={$location_str}&format=json&limit=5&addressdetails=1";
                
                $response = wp_remote_get($url, $timeout);
                if (!is_wp_error($response)) {
                    $data = json_decode(wp_remote_retrieve_body($response), true);
                    if (!empty($data)) {
                        $results = $this->parse_nominatim_results($data);
                    }
                }
            }
        }
        
        // Strategy 5: Last resort - just the name part with "golf" appended if it looks like a club
        if (empty($results)) {
            $parts = array_map('trim', explode(',', $address));
            $name = $parts[0];
            $name_lower = strtolower($name);
            // If it mentions golf/club/course but Nominatim can't find it, search as POI
            if (preg_match('/golf|club|course|links|greens/i', $name_lower)) {
                $results = $this->nominatim_search($name, $timeout);
            }
        }
        
        if (empty($results)) {
            return false;
        }
        
        set_transient($cache_key, $results, 30 * DAY_IN_SECONDS);
        return $results;
    }
    
    /**
     * Execute a Nominatim search query
     */
    private function nominatim_search($query, $timeout, $country_codes = '') {
        $params = array(
            'q' => $query,
            'format' => 'json',
            'limit' => 5,
            'addressdetails' => 1
        );
        if (!empty($country_codes)) {
            $params['countrycodes'] = $country_codes;
        }
        $url = self::NOMINATIM_BASE_URL . '?' . http_build_query($params);
        
        $response = wp_remote_get($url, $timeout);
        
        if (is_wp_error($response)) {
            error_log('Gilba geocoding error: ' . $response->get_error_message());
            return array();
        }
        
        $data = json_decode(wp_remote_retrieve_body($response), true);
        if (empty($data)) {
            return array();
        }
        
        return $this->parse_nominatim_results($data);
    }
    
    /**
     * Parse Nominatim response into standardised results array
     */
    private function parse_nominatim_results($data) {
        $results = array();
        foreach ($data as $location) {
            $results[] = array(
                'lat' => floatval($location['lat']),
                'lon' => floatval($location['lon']),
                'display_name' => $location['display_name'],
                'type' => isset($location['type']) ? $location['type'] : ''
            );
        }
        return $results;
    }
    
    /**
     * Simplify a search query by stripping street/road qualifiers
     * "Federal Golf Club, Gowrie Drive" → "Federal Golf Club"
     * "Royal Melbourne, Cheltenham Road, Black Rock" → "Royal Melbourne"
     */
    private function simplify_query($address) {
        $parts = array_map('trim', explode(',', $address));
        if (count($parts) <= 1) {
            return $address;
        }
        
        // Check if any part looks like a street name
        $street_patterns = '/\b(drive|road|street|avenue|lane|boulevard|way|crescent|place|terrace|parade|circuit|close|court|st|rd|dr|ave|blvd|ln|cres|ct)\b/i';
        
        // Keep parts that don't look like street addresses
        $kept = array();
        foreach ($parts as $part) {
            if (!preg_match($street_patterns, $part)) {
                $kept[] = $part;
            }
        }
        
        // If we stripped everything, just return the first part (the name)
        if (empty($kept)) {
            return $parts[0];
        }
        
        return implode(', ', $kept);
    }
    
    /**
     * AJAX: Search for locations
     */
    public function ajax_geocode_search() {
        // Nonce check — skip for non-logged-in users (nopriv path),
        // enforce for logged-in users. Stale nonces return a refresh prompt.
        if (is_user_logged_in()) {
            if (!check_ajax_referer('gssh_hub_nonce', 'nonce', false)) {
                wp_send_json_error(array('message' => 'Session expired. Please refresh the page.', 'code' => 'nonce_expired'));
                return;
            }
        }
        
        $address = isset($_POST['address']) ? sanitize_text_field($_POST['address']) : '';
        
        if (empty($address) || strlen($address) < 3) {
            wp_send_json_error(array('message' => 'Please enter at least 3 characters'));
        }
        
        $results = $this->geocode_address($address);
        
        if ($results === false || empty($results)) {
            wp_send_json_error(array('message' => 'No locations found. Try a different search.'));
        }
        
        wp_send_json_success($results);
    }
    
    /**
     * AJAX: Reverse geocode - convert lat/lon to place name
     * Proxies Nominatim reverse to avoid CORS issues
     */
    public function ajax_reverse_geocode() {
        if (is_user_logged_in()) {
            if (!check_ajax_referer('gssh_hub_nonce', 'nonce', false)) {
                wp_send_json_error(array('message' => 'Session expired'));
                return;
            }
        }
        
        $lat = isset($_POST['lat']) ? floatval($_POST['lat']) : 0;
        $lon = isset($_POST['lon']) ? floatval($_POST['lon']) : 0;
        
        if ($lat == 0 && $lon == 0) {
            wp_send_json_error(array('message' => 'Invalid coordinates'));
            return;
        }
        
        $url = 'https://nominatim.openstreetmap.org/reverse?' . http_build_query(array(
            'lat' => $lat,
            'lon' => $lon,
            'format' => 'json',
            'zoom' => 16
        ));
        
        $response = wp_remote_get($url, array(
            'timeout' => 8,
            'headers' => array('User-Agent' => 'Gilba Agronomic Hub WordPress Plugin/1.0')
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => 'Reverse geocode failed'));
            return;
        }
        
        $data = json_decode(wp_remote_retrieve_body($response), true);
        
        if (empty($data) || !isset($data['display_name'])) {
            wp_send_json_error(array('message' => 'No results'));
            return;
        }
        
        // b35fix139: reject Nominatim results where country_code doesn't match hemisphere
        // Prevents VN/other wrong-country results for AU/NZ coordinates on boundary polygon edges
        $country_code = isset($data['address']['country_code']) ? strtolower($data['address']['country_code']) : '';
        $southern_codes = array('au','nz','za','ar','cl','br','uy','py','bo','pe','zw','bw','mz','na','ao');
        if ($lat < -10 && !empty($country_code) && !in_array($country_code, $southern_codes)) {
            wp_send_json_success(array('name' => round($lat,4).', '.round($lon,4), 'geocode_rejected' => true));
            return;
        }

        $parts = explode(',', $data['display_name']);
        $short_name = trim(implode(',', array_slice($parts, 0, 3)));
        
        wp_send_json_success(array('name' => $short_name));
    }
    public function ajax_save_location() {
        if (!check_ajax_referer('gssh_hub_nonce', 'nonce', false)) {
            wp_send_json_error(array('message' => 'Security check failed. Please refresh the page.'));
        }
        if (!current_user_can('read')) {
            wp_send_json_error(array('message' => 'Permission denied.'));
        }
        
        $lat = isset($_POST['lat']) ? floatval($_POST['lat']) : 0;
        $lon = isset($_POST['lon']) ? floatval($_POST['lon']) : 0;
        $name = isset($_POST['name']) ? sanitize_text_field($_POST['name']) : '';
        
        if (!$lat || !$lon) {
            wp_send_json_error(array('message' => 'Invalid coordinates'));
        }
        
        // Validate coordinate ranges
        if ($lat < -90 || $lat > 90 || $lon < -180 || $lon > 180) {
            wp_send_json_error(array('message' => 'Coordinates out of valid range'));
        }
        
        // Store in user meta if logged in, otherwise use cookies
        if (is_user_logged_in()) {
            $user_id = get_current_user_id();
            update_user_meta($user_id, 'gssh_latitude', $lat);
            update_user_meta($user_id, 'gssh_longitude', $lon);
            update_user_meta($user_id, 'gssh_location_name', $name);
        } else {
            // Use cookies for non-logged-in users (expires in 30 days)
            $expire = time() + (30 * DAY_IN_SECONDS);
            setcookie('gssh_latitude', $lat, $expire, COOKIEPATH, COOKIE_DOMAIN, is_ssl(), true);
            setcookie('gssh_longitude', $lon, $expire, COOKIEPATH, COOKIE_DOMAIN, is_ssl(), true);
            setcookie('gssh_location_name', $name, $expire, COOKIEPATH, COOKIE_DOMAIN, is_ssl(), true);
        }
        
        wp_send_json_success(array(
            'message' => 'Location saved successfully',
            'lat' => $lat,
            'lon' => $lon,
            'name' => $name
        ));
    }
    
    /**
     * Get saved location (from user meta or cookies)
     */
    public function get_saved_location() {
        $lat = null;
        $lon = null;
        $name = '';
        
        if (is_user_logged_in()) {
            $user_id = get_current_user_id();
            $lat = get_user_meta($user_id, 'gssh_latitude', true);
            $lon = get_user_meta($user_id, 'gssh_longitude', true);
            $name = get_user_meta($user_id, 'gssh_location_name', true);
        } else {
            // Check cookies (sanitize — cookies are user-controlled input)
            $lat = isset($_COOKIE['gssh_latitude']) ? floatval($_COOKIE['gssh_latitude']) : null;
            $lon = isset($_COOKIE['gssh_longitude']) ? floatval($_COOKIE['gssh_longitude']) : null;
            $name = isset($_COOKIE['gssh_location_name']) ? sanitize_text_field($_COOKIE['gssh_location_name']) : '';
        }
        
        if (!empty($lat) && !empty($lon)) {
            // b35fix140: validate saved name against coordinates
            $clean_name = $name;
            if (!empty($name) && floatval($lat) < -10) {
                $southern_indicators = array('australia','new zealand','south africa','argentina',
                    'chile','brazil','act','nsw','victoria','queensland','perth','sydney',
                    'melbourne','brisbane','adelaide','canberra','auckland','wellington',
                    'christchurch','cape town','johannesburg','buenos aires','santiago');
                $name_lower = strtolower($name);
                $looks_southern = false;
                foreach ($southern_indicators as $indicator) {
                    if (strpos($name_lower, $indicator) !== false) { $looks_southern = true; break; }
                }
                if (!$looks_southern && preg_match('/^-?[0-9]+\.[0-9]+,/', $name)) {
                    $looks_southern = true;
                }
                if (!$looks_southern) {
                    $clean_name = round(floatval($lat), 4) . ', ' . round(floatval($lon), 4);
                }
            }
            return array(
                'lat' => floatval($lat),
                'lon' => floatval($lon),
                'name' => $clean_name
            );
        }
        
        // Default to Canberra Stadium if nothing saved
        return array(
            'lat' => -35.3080,
            'lon' => 149.1244,
            'name' => ''
        );
    }
}

// Initialize location manager
GSSH_Location_Manager::get_instance();

// ============================================
// AI INTERPRETATION SUPPORT v1.0.0
// ============================================

/**
 * Register AI interpretation AJAX handler
 */
add_action( 'wp_ajax_gssh_interpret_soil', 'gssh_handle_soil_interpretation' );

/**
 * Handle soil interpretation AJAX request
 */
function gssh_handle_soil_interpretation() {
    if ( ! check_ajax_referer( 'gssh_hub_nonce', 'nonce', false ) ) {
        wp_send_json_error( array( 'message' => 'Security check failed. Please refresh the page.' ) );
    }
    if ( ! current_user_can( 'read' ) ) {
        wp_send_json_error( array( 'message' => 'Permission denied.' ) );
    }
    
    // Get soil output from request
    $soil_output_raw = isset( $_POST['soil_output'] ) ? stripslashes( $_POST['soil_output'] ) : '';
    $soil_output = json_decode( $soil_output_raw, true );
    
    if ( empty( $soil_output ) || json_last_error() !== JSON_ERROR_NONE ) {
        wp_send_json_error( array( 'message' => 'Invalid soil data provided: ' . json_last_error_msg() ) );
    }
    
    // Sanitize soil_output to ensure all keys are strings
    $soil_output = gssh_sanitize_array_keys( $soil_output );
    
    // Include interpretation classes with error handling
    $includes_path = plugin_dir_path( __FILE__ ) . 'includes/';
    
    // class-gssh-soil-interpretation.php deleted — namespace-rename-only fork of class-gilba-soil-interpretation.php.
    if ( ! file_exists( $includes_path . 'class-gilba-soil-interpretation.php' ) ) {
        wp_send_json_error( array( 'message' => 'Interpretation module not installed' ) );
    }
    
    try {
        require_once $includes_path . 'class-gilba-soil-interpretation.php';
        
        // Create interpreter and get interpretation
        $interpreter = new Gilba_Soil_Interpretation();
        
        if ( ! $interpreter->is_available() ) {
            wp_send_json_error( array( 
                'message' => 'AI interpretation not configured. Add GSSH_CLAUDE_API_KEY to wp-config.php' 
            ) );
        }
        
        $result = $interpreter->interpret( $soil_output );
        
        if ( ! $result['success'] ) {
            wp_send_json_error( array( 'message' => isset( $result['error'] ) ? $result['error'] : 'Interpretation failed' ) );
        }
        
        wp_send_json_success( $result );
        
    } catch ( Exception $e ) {
        error_log( '[Gilba Soil Interpretation] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
        wp_send_json_error( array( 'message' => 'Interpretation failed. Please try again.' ) );
    } catch ( Error $e ) {
        error_log( '[Gilba Soil Interpretation] Fatal: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
        wp_send_json_error( array( 'message' => 'Interpretation failed. Please try again.' ) );
    }
}

/**
 * Recursively sanitize array keys to ensure they are strings or integers
 * Prevents "Illegal offset type" errors
 */
function gssh_sanitize_array_keys( $array ) {
    if ( ! is_array( $array ) ) {
        return $array;
    }
    
    $result = array();
    foreach ( $array as $key => $value ) {
        // Convert key to string if it's not a valid type
        if ( is_array( $key ) || is_object( $key ) ) {
            $key = 'invalid_key_' . count( $result );
        }
        
        // Recursively sanitize nested arrays
        if ( is_array( $value ) ) {
            $result[ $key ] = gssh_sanitize_array_keys( $value );
        } else {
            $result[ $key ] = $value;
        }
    }
    
    return $result;
}

// ============================================
// WATER QUALITY AI INTERPRETATION
// ============================================
add_action( 'wp_ajax_gssh_interpret_water', 'gssh_handle_water_interpretation' );

/**
 * Handle water quality interpretation AJAX request
 */
function gssh_handle_water_interpretation() {
    if ( ! check_ajax_referer( 'gssh_hub_nonce', 'nonce', false ) ) {
        wp_send_json_error( array( 'message' => 'Security check failed. Please refresh the page.' ) );
    }
    if ( ! current_user_can( 'read' ) ) {
        wp_send_json_error( array( 'message' => 'Permission denied.' ) );
    }
    
    // Get water output from request
    $water_output_raw = isset( $_POST['water_output'] ) ? stripslashes( $_POST['water_output'] ) : '';
    $water_output = json_decode( $water_output_raw, true );
    
    if ( empty( $water_output ) || json_last_error() !== JSON_ERROR_NONE ) {
        wp_send_json_error( array( 'message' => 'Invalid water data provided: ' . json_last_error_msg() ) );
    }
    
    // Sanitize water_output to ensure all keys are strings
    $water_output = gssh_sanitize_array_keys( $water_output );
    
    // Include interpretation classes with error handling
    $includes_path = plugin_dir_path( __FILE__ ) . 'includes/';
    
    // class-gssh-water-interpretation.php deleted — namespace-rename-only fork of class-gilba-water-interpretation.php.
    if ( ! file_exists( $includes_path . 'class-gilba-water-interpretation.php' ) ) {
        wp_send_json_error( array( 'message' => 'Water interpretation module not installed' ) );
    }
    
    try {
        require_once $includes_path . 'class-gilba-water-interpretation.php';
        
        // Create interpreter and get interpretation
        $interpreter = new Gilba_Water_Interpretation();
        
        if ( ! $interpreter->is_available() ) {
            wp_send_json_error( array( 
                'message' => 'AI interpretation not configured. Add GSSH_CLAUDE_API_KEY to wp-config.php' 
            ) );
        }
        
        $result = $interpreter->interpret( $water_output );
        
        if ( ! $result['success'] ) {
            wp_send_json_error( array( 'message' => isset( $result['error'] ) ? $result['error'] : 'Interpretation failed' ) );
        }
        
        wp_send_json_success( $result );
        
    } catch ( Exception $e ) {
        error_log( '[Gilba Water Interpretation] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
        wp_send_json_error( array( 'message' => 'Interpretation failed. Please try again.' ) );
    } catch ( Error $e ) {
        error_log( '[Gilba Water Interpretation] Fatal: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
        wp_send_json_error( array( 'message' => 'Interpretation failed. Please try again.' ) );
    }
}

// ============================================
// CROSS-MODULE SYNTHESIS AJAX HANDLER
// ============================================
add_action( 'wp_ajax_gssh_interpret_synthesis', 'gssh_handle_synthesis_interpretation' );

/**
 * Handle cross-module synthesis interpretation AJAX request
 */
function gssh_handle_synthesis_interpretation() {
    if ( ! check_ajax_referer( 'gssh_hub_nonce', 'nonce', false ) ) {
        wp_send_json_error( array( 'message' => 'Security check failed. Please refresh the page.' ) );
    }
    if ( ! current_user_can( 'read' ) ) {
        wp_send_json_error( array( 'message' => 'Permission denied.' ) );
    }
    
    // Get combined data from request
    $synthesis_data_raw = isset( $_POST['synthesis_data'] ) ? stripslashes( $_POST['synthesis_data'] ) : '';
    $synthesis_data = json_decode( $synthesis_data_raw, true );
    
    if ( empty( $synthesis_data ) || json_last_error() !== JSON_ERROR_NONE ) {
        wp_send_json_error( array( 'message' => 'Invalid data provided: ' . json_last_error_msg() ) );
    }
    
    // Check we have at least 2 modules
    $modules = 0;
    if ( ! empty( $synthesis_data['soil'] ) ) $modules++;
    if ( ! empty( $synthesis_data['water'] ) ) $modules++;
    if ( ! empty( $synthesis_data['tissue'] ) ) $modules++;
    
    if ( $modules < 2 ) {
        wp_send_json_error( array( 'message' => 'Cross-module analysis requires data from at least 2 modules (soil, water, or tissue).' ) );
    }
    
    // Sanitize data
    $synthesis_data = gssh_sanitize_array_keys( $synthesis_data );
    
    // Include interpretation classes
    $includes_path = plugin_dir_path( __FILE__ ) . 'includes/';
    
    // class-gssh-synthesis-interpretation.php and class-gssh-interpretation.php deleted —
    // namespace-rename-only forks of their Gilba counterparts.
    if ( ! file_exists( $includes_path . 'class-gilba-synthesis-interpretation.php' ) ) {
        wp_send_json_error( array( 'message' => 'Synthesis interpretation module not installed' ) );
    }
    
    try {
        // Include base class first (synthesis extends it)
        require_once $includes_path . 'class-gilba-interpretation.php';
        require_once $includes_path . 'class-gilba-synthesis-interpretation.php';
        
        // Create interpreter and get interpretation
        $interpreter = new Gilba_Synthesis_Interpretation();
        
        if ( ! $interpreter->is_available() ) {
            wp_send_json_error( array( 
                'message' => 'AI interpretation not configured. Add GSSH_CLAUDE_API_KEY to wp-config.php' 
            ) );
        }
        
        $result = $interpreter->interpret( $synthesis_data );
        
        if ( ! $result['success'] ) {
            wp_send_json_error( array( 'message' => isset( $result['error'] ) ? $result['error'] : 'Synthesis failed' ) );
        }
        
        wp_send_json_success( $result );
        
    } catch ( Exception $e ) {
        error_log( '[Gilba Synthesis Interpretation] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
        wp_send_json_error( array( 'message' => 'Interpretation failed. Please try again.' ) );
    } catch ( Error $e ) {
        error_log( '[Gilba Synthesis Interpretation] Fatal: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
        wp_send_json_error( array( 'message' => 'Interpretation failed. Please try again.' ) );
    }
}

// ============================================
// ENQUEUE ASSETS
// ============================================
// ============================================
// SETUP WIZARD — First-Run Detection & AJAX
// ============================================

/**
 * Check if the current user has completed the setup wizard.
 * Returns true if wizard was completed OR if user has no account (non-logged-in).
 */
function gssh_is_wizard_complete() {
    if (!is_user_logged_in()) {
        return false; // Non-logged-in users always see wizard (localStorage handles repeat)
    }
    $user_id = get_current_user_id();
    $wizard_meta = get_user_meta($user_id, 'gssh_wizard_complete', true);
    return !empty($wizard_meta);
}

/**
 * AJAX handler: Mark wizard as complete in user_meta.
 * Also stores the initial turf config chosen during wizard.
 */
function gssh_ajax_wizard_complete() {
    $nonce = isset($_POST['nonce']) ? sanitize_text_field($_POST['nonce']) : '';
    if (!wp_verify_nonce($nonce, 'gssh_hub_nonce')) {
        wp_send_json_error(array('message' => 'Invalid nonce'));
    }
    if (!current_user_can('read')) {
        wp_send_json_error(array('message' => 'Permission denied.'));
    }

    $user_id = get_current_user_id();
    $wizard_data = array(
        'completed_at' => current_time('mysql'),
        'version'      => isset($_POST['version']) ? sanitize_text_field($_POST['version']) : '1.0.0',
        'turf_type'    => isset($_POST['turf_type']) ? sanitize_text_field($_POST['turf_type']) : '',
        'species'      => isset($_POST['species']) ? sanitize_text_field($_POST['species']) : '',
        'variety'      => isset($_POST['variety']) ? sanitize_text_field($_POST['variety']) : '',
        'methodology'  => isset($_POST['methodology']) ? sanitize_text_field($_POST['methodology']) : '',
    );

    update_user_meta($user_id, 'gssh_wizard_complete', $wizard_data);

    wp_send_json_success(array(
        'message' => 'Wizard completion saved',
        'data'    => $wizard_data
    ));
}
add_action('wp_ajax_gssh_wizard_complete', 'gssh_ajax_wizard_complete');

/**
 * AJAX handler: Reset wizard (for re-onboarding or testing).
 */
function gssh_ajax_wizard_reset() {
    $nonce = isset($_POST['nonce']) ? sanitize_text_field($_POST['nonce']) : '';
    if (!wp_verify_nonce($nonce, 'gssh_hub_nonce')) {
        wp_send_json_error(array('message' => 'Invalid nonce'));
    }
    if (!current_user_can('read')) {
        wp_send_json_error(array('message' => 'Permission denied.'));
    }

    if (is_user_logged_in()) {
        $user_id = get_current_user_id();
        delete_user_meta($user_id, 'gssh_wizard_complete');
    }

    wp_send_json_success(array('message' => 'Wizard reset'));
}
add_action('wp_ajax_gssh_wizard_reset', 'gssh_ajax_wizard_reset');

// ============================================
// HYDROSIGHT API PROXY
// Server-side proxy to bypass CORS restrictions
// ============================================

/**
 * AJAX handler: Proxy requests to Hydrosight API
 * Allows browser to call Hydrosight without CORS issues
 */
function gssh_hydrosight_proxy() {
    // Verify nonce
    $nonce = isset($_POST['nonce']) ? sanitize_text_field($_POST['nonce']) : '';
    if (!wp_verify_nonce($nonce, 'gssh_hub_nonce')) {
        wp_send_json_error(array('message' => 'Invalid nonce'), 403);
        wp_die();
    }

    // Security: retrieve API key server-side — never accept from POST body.
    $user_id = get_current_user_id();
    if (!$user_id) {
        wp_send_json_error(array('message' => 'Not logged in'), 401);
        wp_die();
    }
    $api_key = get_user_meta($user_id, 'gilba_sensor_hydrosight_key', true);
    if (empty($api_key)) {
        wp_send_json_error(array('message' => 'No Hydrosight API key configured. Please add your key in Site Settings → Sensor Data.'), 400);
        wp_die();
    }

    $endpoint = isset($_POST['endpoint']) ? sanitize_text_field($_POST['endpoint']) : '';

    if (empty($endpoint)) {
        wp_send_json_error(array('message' => 'Missing endpoint'), 400);
        wp_die();
    }

    // Validate endpoint starts with / and doesn't contain suspicious patterns
    if (strpos($endpoint, '/') !== 0 || preg_match('/[<>"\'\\\\]/', $endpoint)) {
        wp_send_json_error(array('message' => 'Invalid endpoint'), 400);
        wp_die();
    }

    // Build the full URL
    $base_url = 'https://api.hydrosight.au/v1';
    $url = $base_url . $endpoint;

    // Make the request
    $response = wp_remote_get($url, array(
        'timeout' => 30,
        'headers' => array(
            'Accept' => 'application/json',
            'x-api-key' => $api_key
        )
    ));
    
    if (is_wp_error($response)) {
        wp_send_json_error(array(
            'message' => 'API request failed: ' . $response->get_error_message()
        ), 500);
    }
    
    $status_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    
    // Parse JSON response
    $data = json_decode($body, true);
    
    if ($status_code === 200) {
        wp_send_json_success($data);
    } else {
        // Provide actionable error messages for common API failures
        $error_msg = 'API returned status ' . $status_code;
        if ($status_code === 401 || $status_code === 403) {
            $error_msg = 'Invalid or expired API key. Please verify your Hydrosight API key at gethydrosight.com.au';
        } elseif ($status_code === 404) {
            $error_msg = 'Hydrosight API endpoint not found. The API may have been updated.';
        } elseif ($status_code === 429) {
            $error_msg = 'Hydrosight API rate limit exceeded. Please wait a few minutes.';
        } elseif ($status_code >= 500) {
            $error_msg = 'Hydrosight server error (' . $status_code . '). Please try again later.';
        }
        wp_send_json_error(array(
            'message' => $error_msg,
            'status' => $status_code,
            'data' => $data
        ), $status_code);
    }
}
add_action('wp_ajax_gssh_hydrosight_proxy', 'gssh_hydrosight_proxy');

// ============================================
// SENSOR CREDENTIALS & MAPPINGS
// Per-user storage in WordPress user meta
// ============================================

/**
 * AJAX handler: Load sensor credentials from user meta
 */
function gssh_sensor_load_credentials() {
    $nonce = isset($_POST['nonce']) ? sanitize_text_field($_POST['nonce']) : '';
    if (!wp_verify_nonce($nonce, 'gssh_hub_nonce')) {
        wp_send_json_error(array('message' => 'Invalid nonce'), 403);
    }
    
    if (!is_user_logged_in()) {
        wp_send_json_error(array('message' => 'Not logged in'), 401);
    }
    
    $user_id = get_current_user_id();
    
    // Load credentials for each vendor
    $credentials = array();
    $vendor_keys = array('hydrosight', 'soilscout', 'specconnect'); // Supported vendors
    
    foreach ($vendor_keys as $vendor) {
        $key = get_user_meta($user_id, 'gssh_sensor_' . $vendor . '_key', true);
        if (!empty($key)) {
            // Security: never return raw API key to browser.
            $credentials[$vendor] = array('key_set' => true);
        }
    }
    
    // Load site-sensor mappings
    $mappings = get_user_meta($user_id, 'gssh_sensor_mappings', true);
    if (empty($mappings) || !is_array($mappings)) {
        $mappings = new stdClass(); // Forces JSON {} instead of []
    }
    
    wp_send_json_success(array(
        'credentials' => $credentials,
        'siteMappings' => $mappings
    ));
}
add_action('wp_ajax_gssh_sensor_load_credentials', 'gssh_sensor_load_credentials');

/**
 * AJAX handler: Save sensor credentials to user meta
 */
function gssh_sensor_save_credentials() {
    $nonce = isset($_POST['nonce']) ? sanitize_text_field($_POST['nonce']) : '';
    if (!wp_verify_nonce($nonce, 'gssh_hub_nonce')) {
        wp_send_json_error(array('message' => 'Invalid nonce'), 403);
    }
    
    if (!is_user_logged_in()) {
        wp_send_json_error(array('message' => 'Not logged in'), 401);
    }
    
    $user_id = get_current_user_id();
    $vendor_id = isset($_POST['vendor_id']) ? sanitize_key($_POST['vendor_id']) : '';
    $api_key = isset($_POST['api_key']) ? sanitize_text_field($_POST['api_key']) : '';
    
    // Validate vendor ID
    $allowed_vendors = array('hydrosight', 'soilscout', 'specconnect');
    if (!in_array($vendor_id, $allowed_vendors)) {
        wp_send_json_error(array('message' => 'Invalid vendor'), 400);
    }
    
    $meta_key = 'gssh_sensor_' . $vendor_id . '_key';
    
    if (empty($api_key)) {
        // Delete the key
        delete_user_meta($user_id, $meta_key);
    } else {
        // Save the key
        update_user_meta($user_id, $meta_key, $api_key);
    }
    
    wp_send_json_success(array('message' => 'Credentials saved'));
}
add_action('wp_ajax_gssh_sensor_save_credentials', 'gssh_sensor_save_credentials');

/**
 * AJAX handler: Save site-sensor mappings to user meta
 */
function gssh_sensor_save_mappings() {
    $nonce = isset($_POST['nonce']) ? sanitize_text_field($_POST['nonce']) : '';
    if (!wp_verify_nonce($nonce, 'gssh_hub_nonce')) {
        wp_send_json_error(array('message' => 'Invalid nonce'), 403);
    }
    
    if (!is_user_logged_in()) {
        wp_send_json_error(array('message' => 'Not logged in'), 401);
    }
    
    $user_id = get_current_user_id();
    $mappings_json = isset($_POST['mappings']) ? wp_unslash($_POST['mappings']) : '{}';
    
    $mappings = json_decode($mappings_json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        wp_send_json_error(array('message' => 'Invalid JSON'), 400);
    }
    
    // Sanitize the mappings structure
    $sanitized = array();
    if (is_array($mappings)) {
        foreach ($mappings as $site_id => $vendors) {
            $site_id = sanitize_key($site_id);
            if (is_array($vendors)) {
                $sanitized[$site_id] = array();
                foreach ($vendors as $vendor_id => $sensor_ids) {
                    $vendor_id = sanitize_key($vendor_id);
                    if (is_array($sensor_ids)) {
                        $sanitized[$site_id][$vendor_id] = array_map('sanitize_text_field', $sensor_ids);
                    }
                }
            }
        }
    }
    
    update_user_meta($user_id, 'gssh_sensor_mappings', $sanitized);
    
    wp_send_json_success(array('message' => 'Mappings saved'));
}
add_action('wp_ajax_gssh_sensor_save_mappings', 'gssh_sensor_save_mappings');


} // end GILBA_HUB_MODE === 'stadium' (AJAX handlers)



// TEST SUITE removed from production build (b35fix243)

// ============================================
// SHORTCODE RENDER
// ============================================
function gaip_hub_render_shortcode( $atts ) {
    $atts = shortcode_atts( array(
        'mode' => defined( 'GILBA_HUB_MODE' ) ? GILBA_HUB_MODE : 'agronomic',
    ), $atts, 'gaip_hub' );

    $hub_mode = sanitize_key( $atts['mode'] ); // 'agronomic' | 'stadium'

    // Require login — redirect guests to WP login then back to the hub
    if ( ! is_user_logged_in() ) {
        wp_redirect( wp_login_url( get_permalink() ) );
        exit;
    }

    // Get saved location for pre-filling the form
    $location_manager = Gilba_Location_Manager::get_instance();
    $saved_location = $location_manager->get_saved_location();
    
    ob_start();
    ?>
    <div id="gaip-hub">
        <h2>Gilba Agronomic Intelligence Hub</h2>

        <!-- Decision State Machine — b35fix219 -->
        <!-- Scaffold injected by gaip-decision-ui.js on DOMContentLoaded -->
        <!-- Renders above hub grid; re-renders on gaip:orchestrator-complete -->
        <div id="gaip-decision-panel"></div>

        <!-- Evidence View — b35fix229 -->
        <!-- Soil / Water / Tissue / Spray log with chain-of-confidence callouts -->
        <div id="gaip-evidence-panel"></div>

        <div class="gaip-grid">

            <!-- ═══════════════════════════════════════════════════════════════════ -->
            <!-- SITE SELECTOR - Choose which site to work with -->
            <!-- ═══════════════════════════════════════════════════════════════════ -->
            <div id="gaip-site-selector-top" style="
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            ">
                <span style="font-weight: 600; color: #2c5f2d; font-size: 14px;">🏌️ Site:</span>
                <select id="gaip-site-select-top" style="
                    flex: 1;
                    min-width: 200px;
                    max-width: 400px;
                    padding: 8px 12px;
                    border: 1px solid #ced4da;
                    border-radius: 6px;
                    font-size: 14px;
                    background: white;
                ">
                    <option value="default">Loading sites...</option>
                </select>
                <button type="button" id="gaip-site-add-top" title="Add new site" style="
                    padding: 6px 12px; border: 1px solid #ced4da; border-radius: 6px;
                    background: white; cursor: pointer; font-size: 16px;
                ">+</button>
                <button type="button" id="gaip-site-rename-top" title="Rename site" style="
                    padding: 6px 12px; border: 1px solid #ced4da; border-radius: 6px;
                    background: white; cursor: pointer; font-size: 14px;
                ">✎</button>
                <button type="button" id="gaip-site-save-top" title="Save current site configuration" style="
                    padding: 6px 12px; border: 1px solid #28a745; border-radius: 6px;
                    background: #28a745; color: white; cursor: pointer; font-size: 13px; font-weight: 600;
                ">💾 Save Site</button>
                <button type="button" id="gaip-site-delete-top" title="Delete site" style="
                    padding: 6px 12px; border: 1px solid #dc3545; border-radius: 6px;
                    background: white; color: #dc3545; cursor: pointer; font-size: 14px;
                    display: none;
                ">✕</button>
                <span id="gaip-site-status-top" style="font-size: 12px; color: #666;"></span>
            </div>

            <!-- ═══════════════════════════════════════════════════════════════════ -->
            <!-- TURF PROFILE - Foundational Context (must be first) -->
            <!-- Everything cascades from this selection -->
            <!-- ═══════════════════════════════════════════════════════════════════ -->
            <section class="gaip-card gaip-turf-profile-card">
                <div class="gaip-card-header">
                    <h3>Turf Profile <span class="gaip-profile-badge">Sets All Downstream Context</span></h3>
                    <span class="gaip-card-toggle">▼</span>
                </div>
                <div class="gaip-card-body">
                    
                    <!-- Turf Type Selection - Big Buttons -->
                    <div class="gaip-turf-type-grid">
                        <div class="gaip-turf-type-option" data-type="sports">
                            <h4>Sports Field</h4>
                            <p>Soccer, AFL, Rugby</p>
                        </div>
                        <div class="gaip-turf-type-option" data-type="golf">
                            <h4>Golf</h4>
                            <p>Greens, Fairways, Tees</p>
                        </div>
                        <div class="gaip-turf-type-option" data-type="lawns">
                            <h4>Lawns</h4>
                            <p>Residential</p>
                        </div>
                    </div>
                    
                    <!-- Golf Sub-category -->
                    <div class="gaip-subcategory-section" id="gaip-golf-subcategory" style="display: none;">
                        <label>Surface Type</label>
                        <div class="gaip-subcategory-grid">
                            <div class="gaip-subcategory-option" data-surface="greens">Greens</div>
                            <div class="gaip-subcategory-option" data-surface="fairways">Fairways</div>
                            <div class="gaip-subcategory-option" data-surface="tees">Tees</div>
                            <div class="gaip-subcategory-option" data-surface="surrounds">Surrounds</div>
                        </div>
                    </div>
                    
                    <!-- Sports Sub-category -->
                    <div class="gaip-subcategory-section" id="gaip-sports-subcategory" style="display: none;">
                        <label>Sport</label>
                        <div class="gaip-subcategory-grid">
                            <div class="gaip-subcategory-option" data-sport="soccer">Soccer</div>
                            <div class="gaip-subcategory-option" data-sport="afl">AFL</div>
                            <div class="gaip-subcategory-option" data-sport="rugby_union">Rugby Union</div>
                            <div class="gaip-subcategory-option" data-sport="rugby_league">Rugby League</div>
                        </div>
                    </div>
                    
                    <!-- Species & Variety -->
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Species</label>
                            <select class="gaip-species" id="gaip-species-select">
                                <!-- Populated dynamically by turf-profile-controller.js -->
                                <option value="">Select turf type first</option>
                            </select>
                        </div>
                        <div>
                            <label>Variety</label>
                            <select class="gaip-variety" id="gaip-variety-select">
                                <option value="generic">Generic / Unknown</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Construction & Drainage -->
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Construction</label>
                            <select class="gaip-construction">
                                <option value="sand_carpet">Sand carpet</option>
                                <option value="sand_profile">Sand profile (USGA-style)</option>
                                <option value="pipe_drained">Pipe drained + slit drained</option>
                                <option value="soil">Soil field</option>
                                <option value="hybrid">Hybrid reinforced</option>
                            </select>
                        </div>
                        <div>
                            <label>Drainage</label>
                            <select class="gaip-drainage">
                                <option value="excellent">Excellent (&gt;150 mm/hr)</option>
                                <option value="good">Good (100-150 mm/hr)</option>
                                <option value="moderate">Moderate (50-100 mm/hr)</option>
                                <option value="poor">Poor (&lt;50 mm/hr)</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- HOC & N Program -->
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Height of Cut (mm)</label>
                            <input type="number" class="gaip-hoc" value="25" step="0.5" min="1" max="100">
                        </div>
                        <div>
                            <label>N Program (kg/ha/yr)</label>
                            <!-- b35fix312 Fix 3: removed hardcoded value="200" default.
                                 Turf profile controller populates this based on
                                 species when a species is selected. Leaving it
                                 blank makes the Nutrition Program panel input
                                 (.gaip-nutrition-annual-n) the authoritative
                                 user-facing entry point, which is what the
                                 engine readers now prefer (Fix 2). -->
                            <input type="number" class="gaip-n-program" placeholder="e.g. 160" step="10" min="0" max="500">
                        </div>
                    </div>
                    
                    <!-- Overseed Section (C4 only - controlled by JS) -->
                    <div class="gaip-overseed-section" style="display: none; margin-top: 15px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
                        <div style="font-weight: 600; color: #166534; margin-bottom: 10px;">Winter Overseed Program</div>
                        
                        <label>Overseed Species</label>
                        <select class="gaip-cool-overseed">
                            <option value="">None / No overseed</option>
                            <option value="Perennial Ryegrass">Perennial Ryegrass</option>
                        </select>
                        
                        <label>Overseed Variety</label>
                        <select class="gaip-overseed-variety">
                            <option value="generic">Generic / Unknown</option>
                            <option value="RPR">RPR (Regenerating)</option>
                            <option value="Slugger 3GL">Slugger 3GL</option>
                            <option value="Derby Xtreme">Derby Xtreme</option>
                            <option value="SR 4700">SR 4700</option>
                            <option value="Karma">Karma</option>
                            <option value="Barolympic">Barolympic</option>
                            <option value="Barorlando">Barorlando</option>
                            <option value="Pinnacle 3">Pinnacle 3</option>
                            <option value="Premier 3">Premier 3</option>
                            <option value="Intense">Intense</option>
                            <option value="Grand Slam GLS">Grand Slam GLS</option>
                            <option value="APS">APS</option>
                        </select>
                        
                        <label>Summer Management Intent</label>
                        <select class="gaip-overseed-summer-intent">
                            <option value="transition">Transition — let ryegrass fade, support couch recovery</option>
                            <option value="maintain">Maintain — keep ryegrass through summer (poor couch base)</option>
                        </select>
                        <small style="color:#666; font-size:10px;">Choose 'Maintain' if underlying couch coverage is poor and surface needs ryegrass for playability</small>
                        
                        <div class="gaip-note" style="margin-top: 8px; font-size: 11px; color: #166534;">
                            Overseed active during winter months (May-Sep in Australia).
                        </div>
                    </div>
                    
                    <!-- Site History (for disease risk calculation) -->
                    <div class="gaip-site-history-section" style="margin-top: 15px; padding: 12px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px;">
                        <div style="font-weight: 600; color: #92400e; margin-bottom: 10px;">Site History <span style="font-weight: normal; font-size: 11px;">(for disease risk)</span></div>
                        
                        <div class="gaip-form-row-grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                            <div>
                                <label>Years Established</label>
                                <input type="number" class="gaip-years-established" placeholder="e.g. 5" step="1" min="0" max="50">
                                <small style="color:#666; font-size:10px;">SDS peak risk: 3-7 years</small>
                            </div>
                            <div>
                                <label>Thatch Depth (mm)</label>
                                <input type="number" class="gaip-thatch-depth" placeholder="e.g. 12" step="1" min="0" max="50">
                                <small style="color:#666; font-size:10px;">Target: &lt;12mm</small>
                            </div>
                            <div>
                                <label>Winter Min Temp (°C)</label>
                                <input type="number" class="gaip-winter-min-temp" placeholder="e.g. -2" step="0.5" min="-20" max="15">
                                <small style="color:#666; font-size:10px;">Coldest last winter</small>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Profile Save/Load -->
                    <div class="gaip-profile-controls">
                        <select id="gaip-profile-select">
                            <option value="">-- Saved Profiles --</option>
                        </select>
                        <button type="button" id="gaip-save-profile" class="gaip-save-btn">Save Profile</button>
                        <button type="button" id="gaip-delete-profile" class="gaip-delete-btn">Delete</button>
                    </div>
                    
                    <!-- Profile Summary -->
                    <div class="gaip-profile-summary" id="gaip-profile-summary"></div>
                    
                </div>
            </section>

            <section class="gaip-card">
                <div class="gaip-card-header">
                    <h3>Site &amp; Climate</h3>
                    <span class="gaip-card-toggle">▼</span>
                </div>
                <div class="gaip-card-body">
                    <label>Location (for live weather)</label>
                    <div style="position: relative;">
                        <input type="text" 
                               id="gaip-location-search" 
                               placeholder="Search suburb, city, or stadium..." 
                               autocomplete="off"
                               value="<?php echo esc_attr($saved_location['name']); ?>"
                               style="width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px;">
                        <div id="gaip-location-results" style="
                            position: absolute;
                            top: 100%;
                            left: 0;
                            right: 0;
                            background: white;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                            z-index: 1000;
                            max-height: 250px;
                            overflow-y: auto;
                            display: none;
                        "></div>
                    </div>
                    <div id="gaip-location-status" style="font-size: 11px; margin-top: 4px; color: #666;"></div>
                    
                    <div class="gaip-form-row-grid" style="margin-top: 10px;">
                        <div>
                            <label>Latitude</label>
                            <input type="number" step="0.0001" class="gaip-lat" value="<?php echo esc_attr($saved_location['lat']); ?>">
                        </div>
                        <div>
                            <label>Longitude</label>
                            <input type="number" step="0.0001" class="gaip-lon" value="<?php echo esc_attr($saved_location['lon']); ?>">
                        </div>
                    </div>

                    <!-- Map picker: click or drag to set exact location -->
                    <div id="gaip-location-map" style="
                        width: 100%; 
                        height: 220px; 
                        margin-top: 10px; 
                        border-radius: 6px; 
                        border: 1px solid #ccc;
                        background: #eee;
                        cursor: crosshair;
                    "></div>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
                        <div style="font-size:11px;color:#888;">Click map or drag pin to set exact location</div>
                        <button id="gaip-map-scroll-lock" type="button" onclick="(function(){
                            var m = window.GAIP_LocationMap;
                            if (!m) return;
                            var locked = !m.scrollWheelZoom.enabled();
                            if (locked) { m.scrollWheelZoom.disable(); document.getElementById('gaip-map-scroll-lock').textContent = '🔓 Unlock scroll zoom'; }
                            else        { m.scrollWheelZoom.enable();  document.getElementById('gaip-map-scroll-lock').textContent = '🔒 Lock scroll zoom'; }
                        })()" style="font-size:11px;padding:3px 8px;border:1px solid #d1d5db;border-radius:4px;background:white;cursor:pointer;color:#6b7280;">🔓 Unlock scroll zoom</button>
                    </div>

                    <label>Hemisphere</label>
                    <select class="gaip-hemi">
                        <option value="southern" selected>Southern</option>
                        <option value="northern">Northern</option>
                    </select>
                    
                    <div class="gaip-form-row-grid" style="margin-top: 10px;">
                        <div>
                            <label>Analysis start date</label>
                            <input type="date" class="gaip-start-date">
                        </div>
                        <div>
                            <label>Analysis end date</label>
                            <input type="date" class="gaip-end-date">
                        </div>
                    </div>
                    <p style="font-size: 11px; color: #666; margin-top: 4px;">Leave blank for 7-day forecast from today. Max 14 days ahead for live weather.</p>

                    <label>Elevation (m)</label>
                    <input type="number" class="gaip-elev" value="50">

                    <label class="gaip-module-toggle" style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" class="gaip-use-live-weather" checked>
                        <span>Use live weather data (Open-Meteo)</span>
                    </label>
                    
                    <div style="margin-top: 8px; display: flex; align-items: center; gap: 10px;">
                        <button type="button" id="gaip-refresh-weather" onclick="if(window.GAIP_WeatherResilience){GAIP_WeatherResilience.clearCache();this.textContent='✓ Cache cleared - run analysis';this.style.background='#dcfce7';}" style="padding: 6px 12px; font-size: 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer;">
                            🔄 Refresh Weather Cache
                        </button>
                        <span id="gaip-weather-status-inline" style="font-size: 11px; color: #6b7280;"></span>
                    </div>

                    <div class="gaip-manual-weather" style="display:none; margin-top:10px; padding: 10px; background: #f5f5f5; border-radius: 6px;">
                        <p style="font-size: 11px; color: #666; margin: 0 0 10px 0;">Enter weather conditions for growth potential and stress calculations.</p>
                        
                        <div class="gaip-form-row-grid">
                            <div>
                                <label>Min air temp (°C)</label>
                                <input type="number" step="0.1" class="gaip-manual-tmin" value="12" placeholder="e.g. 12">
                            </div>
                            <div>
                                <label>Max air temp (°C)</label>
                                <input type="number" step="0.1" class="gaip-manual-tmax" value="24" placeholder="e.g. 24">
                            </div>
                        </div>

                        <div class="gaip-form-row-grid" style="margin-top: 10px;">
                            <div>
                                <label>Humidity (%)</label>
                                <input type="number" step="1" class="gaip-manual-humidity" value="65" min="0" max="100">
                            </div>
                            <div>
                                <label>Rainfall (mm/week)</label>
                                <input type="number" step="0.1" class="gaip-manual-rain" value="0" min="0">
                            </div>
                        </div>

                        <div class="gaip-form-row-grid" style="margin-top: 10px;">
                            <div>
                                <label>Soil temp @ 10cm (°C)</label>
                                <input type="number" step="0.1" class="gaip-manual-soil-temp" value="" placeholder="auto">
                            </div>
                            <div>
                                <label>ET₀ (mm/day) <span style="font-weight: normal; color: #999;">(optional)</span></label>
                                <input type="number" step="0.1" class="gaip-manual-eto" value="" placeholder="e.g. 4.5">
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
                        <label>Monthly N Rate (kg/ha) <span style="font-weight: normal; color: #666; font-size: 11px;">— for N program validation</span></label>
                        <input type="number" step="1" class="gaip-monthly-n-rate" value="" placeholder="e.g. 25" min="0" max="100">
                        <p style="font-size: 11px; color: #666; margin-top: 4px;">Enter your current monthly nitrogen application rate to compare against growth-limited uptake capacity.</p>
                    </div>
                </div>
            </section>

            <!-- =====================================================
                 SOIL DATA CARD (redesigned v2)
                 ===================================================== -->
            <section class="gaip-card gaip-soil-card">
                <div class="gaip-card-header">
                    <h3>Soil Test Data</h3>
                    <div class="gaip-header-controls">
                        <label class="gaip-module-toggle">
                            <input type="checkbox" class="gaip-enable-soil-water" checked>
                            <span>Enable Analysis</span>
                        </label>
                        <span class="gaip-card-toggle">▼</span>
                    </div>
                </div>
                <div class="gaip-card-body">

                    <!-- Context indicator -->
                    <div class="gaip-context-indicator" data-section="mlsn">
                        Select turf type above to set interpretation thresholds
                    </div>

                    <!-- ── SAMPLE MANAGEMENT BAR (injected by sample-switcher-ui.js) ── -->
                    <!-- Switcher mounts here via data-switcher-target="soil" -->
                    <div class="gaip-soil-switcher-mount"></div>

                    <!-- ── IMPORT STRIP ── -->
                    <div class="gaip-import-strip">
                        <button type="button" class="gaip-import-btn gaip-import-primary" id="gaip-soil-pdf-import-btn">
                            <span class="gaip-import-icon">📄</span>
                            <span>Import from PDF / CSV</span>
                        </button>
                        <span class="gaip-import-or">or enter manually below</span>
                    </div>

                    <!-- ── SAMPLE IDENTITY ── -->
                    <div class="gaip-field-group">
                        <div class="gaip-field-group-title">Sample identity</div>
                        <div class="gaip-field-row-4">
                            <div class="gaip-field">
                                <label>Sample name</label>
                                <input type="text" class="gaip-soil-sample-label" placeholder="e.g. Green 1, Fairway 7">
                            </div>
                            <div class="gaip-field">
                                <label>Area (ha)</label>
                                <input type="number" step="0.01" min="0" class="gaip-soil-area-ha"
                                       placeholder="e.g. 0.06"
                                       title="Area of the zone this sample represents, in hectares. Used for fertiliser purchasing totals. Optional — leave blank to report per-hectare rates only."
                                       aria-label="Area in hectares">
                                <div class="gaip-soil-area-warning"
                                     style="display:none; color:#c96a5f; font-size:11px; margin-top:3px; line-height:1.3;"></div>
                            </div>
                            <div class="gaip-field">
                                <label>Lab reference</label>
                                <input type="text" class="gaip-soil-lab-ref" placeholder="e.g. ARL-24-1234">
                            </div>
                            <div class="gaip-field">
                                <label>Collection date</label>
                                <input type="date" class="gaip-soil-date">
                            </div>
                        </div>
                    </div>

                    <!-- ── METHODOLOGY ── -->
                    <div class="gaip-field-group">
                        <div class="gaip-field-group-title">Interpretation method</div>
                        <select class="gaip-soil-methodology">
                            <option value="slan">SLAN — Sufficiency Level of Available Nutrients</option>
                            <option value="mlsn">MLSN — Minimum Levels for Sustainable Nutrition</option>
                        </select>
                        <div class="gaip-method-notes" style="color:#666; font-size: 12px; margin-top: 6px; line-height: 1.5;">
                            <span class="gaip-method-note-slan"><strong>SLAN:</strong> Traditional sufficiency-range approach — widely used across all turf types</span>
                            <span class="gaip-method-note-mlsn" style="display:none;"><strong>MLSN:</strong> Threshold-based approach — validated primarily on golf putting greens</span>
                            <span class="gaip-method-note-aa gaip-aa-method-note" style="display:none;"><strong>Ammonium Acetate:</strong> Hill Labs NZ method (Olsen P + NH₄OAc)</span>
                        </div>
                        <div class="gaip-aa-soil-texture-container" style="display: none; margin-top: 8px;"></div>
                        <div class="gaip-soil-method-warning" style="display: none; margin-top: 8px;"></div>
                    </div>

                    <!-- ── NUTRIENTS ── -->
                    <div class="gaip-field-group">
                        <div class="gaip-field-group-title">
                            <span class="gaip-soil-method-label">Soil test values (ppm)</span>
                            <span class="gaip-soil-method-note" style="font-weight:normal; color:#888; font-size:11px; margin-left:6px;">Mehlich 3 (Olsen for P)</span>
                        </div>
                        <div class="gaip-nutrient-grid gaip-soil-grid">
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">K</span><input type="number" step="1" data-mlsn="K" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">P</span><input type="number" step="1" data-mlsn="P" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Ca</span><input type="number" step="1" data-mlsn="Ca" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Mg</span><input type="number" step="1" data-mlsn="Mg" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">S</span><input type="number" step="1" data-mlsn="S" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Fe</span><input type="number" step="0.1" data-mlsn="Fe" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Mn</span><input type="number" step="0.1" data-mlsn="Mn" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Cu</span><input type="number" step="0.01" data-mlsn="Cu" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Zn</span><input type="number" step="0.01" data-mlsn="Zn" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">B</span><input type="number" step="0.01" data-mlsn="B" title="Boron — hot water or Mehlich 3 extractable" placeholder="ppm"></div>
                            <div class="gaip-nutrient-cell gaip-nutrient-cell--secondary" title="Sodium — for ESP/sodicity, not an MLSN target"><span class="gaip-nutrient-symbol">Na</span><input type="number" step="1" data-mlsn="Na" placeholder="ppm"></div>
                        </div>
                        <small style="color:#aaa; font-size:11px; margin-top:4px; display:block;">Na: sodicity assessment only, not an MLSN target</small>
                    </div>

                    <!-- ── PHYSICAL PROPERTIES ── -->
                    <div class="gaip-field-group">
                        <div class="gaip-field-group-title">Physical properties</div>
                        <div class="gaip-field-row-3">
                            <div class="gaip-field">
                                <label>Soil pH</label>
                                <input type="number" step="0.1" class="gaip-soil-ph" placeholder="e.g. 6.2">
                            </div>
                            <div class="gaip-field">
                                <label>CEC (cmol/kg)</label>
                                <input type="number" step="0.1" class="gaip-cec" placeholder="e.g. 8.5">
                            </div>
                            <div class="gaip-field">
                                <label>EC<sub>1:5</sub> (dS/m)</label>
                                <input type="number" step="0.01" class="gaip-soil-ec" placeholder="e.g. 0.15">
                            </div>
                        </div>
                        <div class="gaip-field-row-2" style="margin-top:8px;">
                            <div class="gaip-field">
                                <label>Soil texture</label>
                                <select class="gaip-soil-texture">
                                    <option value="sand">Sand / Sand rootzone</option>
                                    <option value="loamy_sand">Loamy Sand</option>
                                    <option value="sandy_loam">Sandy Loam</option>
                                    <option value="loam" selected>Loam</option>
                                    <option value="clay_loam">Clay Loam</option>
                                    <option value="clay">Clay</option>
                                </select>
                            </div>
                            <div class="gaip-field">
                                <label>Sampling depth</label>
                                <select class="gaip-sampling-depth">
                                    <option value="">Not specified</option>
                                    <option value="0-2">0–2 cm (surface)</option>
                                    <option value="2-4">2–4 cm (shallow rootzone)</option>
                                    <option value="4-6">4–6 cm (rootzone)</option>
                                    <option value="0-10">0–10 cm (standard)</option>
                                </select>
                            </div>
                        </div>
                        <div class="gaip-field" style="margin-top:8px;">
                            <label>Organic Matter / LOI (%)</label>
                            <input type="number" step="0.1" class="gaip-loi" placeholder="e.g. 2.5" min="0" max="30">
                        </div>
                    </div>

                    <!-- ── STRATIFIED OM (golf greens — shown/hidden by JS) ── -->
                    <div class="gaip-stratified-om-section gaip-collapsible-section" style="display: none;">
                        <div class="gaip-collapsible-header" data-target="gaip-strat-om-body">
                            <span>⛳ Stratified OM Analysis <small style="font-weight:normal; color:#888;">(Golf Greens)</small></span>
                            <span class="gaip-collapsible-toggle">▶</span>
                        </div>
                        <div class="gaip-collapsible-body" id="gaip-strat-om-body" style="display:none;">
                            <small style="color:#666; display:block; margin-bottom:8px;">LOI % at each depth — detects layering issues</small>
                            <div class="gaip-nutrient-grid" style="grid-template-columns: repeat(3, 1fr);">
                                <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol" style="font-size:10px;">0–2cm</span><input type="number" step="0.1" class="gaip-loi-0-2" placeholder="%" min="0" max="30"></div>
                                <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol" style="font-size:10px;">2–4cm</span><input type="number" step="0.1" class="gaip-loi-2-4" placeholder="%" min="0" max="30"></div>
                                <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol" style="font-size:10px;">4–6cm</span><input type="number" step="0.1" class="gaip-loi-4-6" placeholder="%" min="0" max="30"></div>
                            </div>
                            <small style="color:#888; margin-top:6px; display:block;">USGA spec: 2–4% optimal. Stratification = thatch/layering risk.</small>
                        </div>
                    </div>

                </div>
            </section>

            <!-- =====================================================
                 WATER QUALITY CARD (redesigned v2)
                 ===================================================== -->
            <section class="gaip-card gaip-water-card">
                <div class="gaip-card-header">
                    <h3>Water Quality</h3>
                    <div class="gaip-header-controls">
                        <span class="gaip-card-toggle">▼</span>
                    </div>
                </div>
                <div class="gaip-card-body">

                    <!-- ── SAMPLE MANAGEMENT BAR (injected by sample-switcher-ui.js) ── -->
                    <div class="gaip-water-switcher-mount"></div>

                    <!-- ── IMPORT STRIP ── -->
                    <div class="gaip-import-strip">
                        <button type="button" class="gaip-import-btn gaip-import-primary" id="gaip-water-pdf-import-btn">
                            <span class="gaip-import-icon">📄</span>
                            <span>Import from PDF / CSV</span>
                        </button>
                        <span class="gaip-import-or">or enter manually below</span>
                    </div>

                    <!-- ── SAMPLE IDENTITY ── -->
                    <div class="gaip-field-group">
                        <div class="gaip-field-group-title">Sample identity</div>
                        <div class="gaip-field-row-3">
                            <div class="gaip-field">
                                <label>Water source</label>
                                <input type="text" class="gaip-water-source-label" placeholder="e.g. Bore, Dam, Recycled">
                            </div>
                            <div class="gaip-field">
                                <label>Lab reference</label>
                                <input type="text" class="gaip-water-lab-ref" placeholder="e.g. ARL-24-5678">
                            </div>
                            <div class="gaip-field">
                                <label>Collection date</label>
                                <input type="date" class="gaip-water-date">
                            </div>
                        </div>
                    </div>

                    <!-- ── RECYCLED WATER TOGGLE ── -->
                    <div class="gaip-field-group gaip-recycled-water-toggle-group">
                        <label class="gaip-recycled-water-label">
                            <input type="checkbox" class="gaip-recycled-water-flag" id="gaip-recycled-water-flag">
                            <span>Recycled / reclaimed water</span>
                        </label>
                        <p class="gaip-recycled-water-hint">Enables salt-driven nutrient interaction advisory (N-form, micronutrient suppression, cation ratio disturbance)</p>
                    </div>

                    <!-- ── KEY PARAMETERS ── -->
                    <div class="gaip-field-group">
                        <div class="gaip-field-group-title">Key parameters</div>
                        <div class="gaip-field-row-2">
                            <div class="gaip-field">
                                <label>EC<sub>w</sub> (dS/m)</label>
                                <input type="number" step="0.01" class="gaip-ecw" placeholder="Electrical conductivity">
                            </div>
                            <div class="gaip-field">
                                <label>pH</label>
                                <input type="number" step="0.1" class="gaip-water-ph" placeholder="e.g. 7.5">
                            </div>
                        </div>
                    </div>

                    <!-- ── ION COMPOSITION ── -->
                    <div class="gaip-field-group">
                        <div class="gaip-field-group-title">Ion composition (mg/L)</div>
                        <div class="gaip-nutrient-grid gaip-water-grid">
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Ca</span><input type="number" step="0.1" data-ion="Ca" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Mg</span><input type="number" step="0.1" data-ion="Mg" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Na</span><input type="number" step="0.1" data-ion="Na" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">K</span><input type="number" step="0.1" data-ion="K" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Cl</span><input type="number" step="0.1" data-ion="Cl" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">SO₄</span><input type="number" step="0.1" data-ion="SO4" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">HCO₃</span><input type="number" step="0.1" data-ion="HCO3" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">CO₃</span><input type="number" step="0.1" data-ion="CO3" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">B</span><input type="number" step="0.1" data-ion="B" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Fe</span><input type="number" step="0.01" data-ion="Fe" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">Mn</span><input type="number" step="0.01" data-ion="Mn" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol">NO₃</span><input type="number" step="0.1" data-ion="NO3" placeholder="mg/L"></div>
                            <div class="gaip-nutrient-cell"><span class="gaip-nutrient-symbol" title="Phosphorus as reported by lab">P</span><input type="number" step="0.1" data-ion="PO4" placeholder="mg/L"></div>
                        </div>
                    </div>

                    <!-- ── IRRIGATION SYSTEM (collapsed by default) ── -->
                    <div class="gaip-collapsible-section">
                        <div class="gaip-collapsible-header" data-target="gaip-irr-system-body">
                            <span>Irrigation system <small style="font-weight:normal; color:#888;">(optional)</small></span>
                            <span class="gaip-collapsible-toggle">▶</span>
                        </div>
                        <div class="gaip-collapsible-body" id="gaip-irr-system-body" style="display:none;">
                            <div class="gaip-field-row-2">
                                <div class="gaip-field">
                                    <label>Irrigation method</label>
                                    <select class="gaip-irr-method">
                                        <option value="">Not specified</option>
                                        <option value="sprinkler">Sprinkler / Overhead</option>
                                        <option value="drip">Drip / Sub-surface</option>
                                        <option value="mixed">Mixed system</option>
                                    </select>
                                    <small>Affects foliar phytotoxicity risk</small>
                                </div>
                                <div class="gaip-field">
                                    <label>System efficiency (%)</label>
                                    <input type="number" class="gaip-irr-efficiency" value="75" min="40" max="95">
                                    <small>Sprinklers 70–80%, Drip 85–95%</small>
                                </div>
                            </div>
                            <div class="gaip-field-row-2" style="margin-top:8px;">
                                <div class="gaip-field">
                                    <label>Effective rainfall (%)</label>
                                    <input type="number" class="gaip-irr-rain-eff" value="80" min="0" max="100">
                                    <small>Fraction infiltrating (not runoff)</small>
                                </div>
                                <div class="gaip-field">
                                    <label>Cost per kL ($/kL)</label>
                                    <input type="number" class="gaip-irr-cost" value="3.00" step="0.10" min="0">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ── SOIL WATER STATUS (collapsed by default) ── -->
                    <div class="gaip-collapsible-section">
                        <div class="gaip-collapsible-header" data-target="gaip-soil-water-body">
                            <span>Soil water status <small style="font-weight:normal; color:#888;">(optional)</small></span>
                            <span class="gaip-collapsible-toggle">▶</span>
                        </div>
                        <div class="gaip-collapsible-body" id="gaip-soil-water-body" style="display:none;">
                            <div class="gaip-field-row-2">
                                <div class="gaip-field">
                                    <label>Days since last irrigation</label>
                                    <input type="number" class="gaip-days-since-irrigation" value="1" min="0" max="30" step="1">
                                    <small>0 = irrigated today</small>
                                </div>
                                <div class="gaip-field">
                                    <label>Soil moisture (%VWC) <span class="gaip-tooltip" title="Volumetric water content from TDR/capacitance probe. Leave blank to estimate from days since irrigation.">ⓘ</span></label>
                                    <input type="number" class="gaip-soil-vwc" placeholder="e.g. 18" min="0" max="60" step="1">
                                    <small>Optional — from sensor reading</small>
                                </div>
                            </div>
                            <div class="gaip-field" style="margin-top:8px;">
                                <label>Effective root depth (mm)</label>
                                <input type="number" class="gaip-root-depth" value="100" min="25" max="300" step="5">
                                <small>Greens: 75–100mm · Fairways: 100–150mm · Sports: 100–200mm</small>
                            </div>
                        </div>
                    </div>

                    <!-- ── SENSOR IMPORT (collapsed by default) ── -->
                    <div class="gaip-collapsible-section">
                        <div class="gaip-collapsible-header" data-target="gaip-sensor-import-body">
                            <span>📡 Sensor data import <small style="font-weight:normal; color:#888;">(TDR 350 / compatible)</small></span>
                            <span class="gaip-collapsible-toggle">▶</span>
                        </div>
                        <div class="gaip-collapsible-body" id="gaip-sensor-import-body" style="display:none;">
                            <div id="gaip-sensor-upload-area" class="gaip-sensor-upload">
                                <div class="gaip-sensor-upload-icon">📁</div>
                                <div class="gaip-sensor-upload-text">Drop CSV file here or click to browse</div>
                                <div class="gaip-sensor-upload-hint">Supports TDR 350/300 exports and compatible formats</div>
                                <input type="file" id="gaip-sensor-file" accept=".csv" style="display: none;">
                            </div>
                            <div id="gaip-sensor-result"></div>
                            <div id="gaip-sensor-summary-container"></div>
                        </div>
                    </div>

                </div>
            </section>

            <section class="gaip-card" style="grid-column: 1 / -1;">
                <div class="gaip-card-header">
                    <h3>Tissue Testing</h3>
                    <div class="gaip-header-controls">
                        <label class="gaip-module-toggle">
                            <input type="checkbox" class="gaip-enable-tissue" checked>
                            <span>Enable Analysis</span>
                        </label>
                        <span class="gaip-card-toggle">▼</span>
                    </div>
                </div>
                <div class="gaip-card-body">
                    <!-- Context indicator - set by Turf Profile -->
                    <div class="gaip-context-indicator" data-section="tissue">
                        Select turf type above to set tissue interpretation ranges
                    </div>
                    <div id="gaipTissueModule" class="gaip-tissue-module"></div>
                </div>
            </section>

            <section class="gaip-card" style="grid-column: 1 / -1;">
                <div class="gaip-card-header">
                    <h3>PGR &amp; Light Conditions</h3>
                    <div class="gaip-header-controls">
                        <label class="gaip-module-toggle">
                            <input type="checkbox" class="gaip-enable-turf-system" checked>
                            <span>Enable Analysis</span>
                        </label>
                        <span class="gaip-card-toggle">▼</span>
                    </div>
                </div>
                <div class="gaip-card-body">
                    <!-- Context indicator - set by Turf Profile -->
                    <div class="gaip-context-indicator" data-section="shade">
                        Select turf type above to set DLI thresholds
                    </div>

                    <!-- Poa annua Contamination Section (Golf Greens only) -->
                    <div class="gaip-poa-section" style="margin-top: 0; margin-bottom: 15px; padding: 12px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; display: none;">
                        <div style="font-weight: 600; color: #92400e; margin-bottom: 10px;">Poa annua Population</div>
                        
                        <label>Poa annua %</label>
                        <input type="number" class="gaip-poa-percent" value="0" min="0" max="100" step="5">
                        
                        <div class="gaip-note" style="margin-top: 8px; font-size: 11px; color: #92400e;">
                            Poa contamination affects disease risk (Anthracnose, Pythium) and irrigation 
                            requirements (shallow roots need more frequent watering).
                        </div>
                    </div>

                    <label>% C3 cover (transition periods)</label>
                    <input type="number" class="gaip-c3-cover" value="0">
                    <small style="color:#666;">For warm-season turf with cool-season overseed during transition</small>
                    
                    <!-- PGR/DMI inputs removed — b35fix233. Engine reads from GAIP_LAST_PGR (spray log). Enter via Programmes tab. -->


                    <div class="gaip-note" style="margin-top:12px; padding-top:8px; border-top:1px solid #ddd;">
                        <strong>Optional surface hardness (Clegg hammer):</strong>
                    </div>
                    <label>Clegg value - Mean (Gmax)</label>
                    <input type="number" step="1" class="gaip-clegg-hammer" placeholder="e.g. 75 (leave blank to estimate)">
                    
                    <div class="gaip-clegg-range-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px;">
                        <div>
                            <label style="font-size: 12px;">Hardest zone (Gmax)</label>
                            <input type="number" step="1" class="gaip-clegg-max" placeholder="e.g. goalmouth">
                        </div>
                        <div>
                            <label style="font-size: 12px;">Softest zone (Gmax)</label>
                            <input type="number" step="1" class="gaip-clegg-min" placeholder="e.g. wing area">
                        </div>
                    </div>
                    <div class="gaip-note" style="font-size:11px; color:#666; margin-top:4px;">
                        Standard 2.25kg Clegg @ 450mm. Typical: 60-90 Gmax. &lt;60=soft, 60-90=ideal, &gt;100=too hard.<br>
                        <em>For sports fields: record readings from goalmouth (hardest) and wing (softest) to assess uniformity.</em>
                    </div>

                    <label>Daily light integral (mol/m²/day)</label>
                    <input type="number" step="0.5" class="gaip-dli" placeholder="Leave blank for API calculation">
                    
                    <div class="gaip-note" style="margin-top:8px;">
                        <strong>Optional LED supplementation data:</strong>
                    </div>
                    <label>LED PPFD (µmol/m²/s)</label>
                    <input type="number" step="10" class="gaip-led-ppfd" placeholder="e.g. 800, 1000, 1200">
                    
                    <label>LED hours per day</label>
                    <input type="number" step="0.5" class="gaip-led-hours" placeholder="e.g. 8">

                    <div class="gaip-note" style="margin-top:8px;">
                        <strong>Optional shade/obstruction data:</strong>
                        <label class="gaip-module-toggle" style="display:inline-block; margin-left:15px;">
                            <input type="checkbox" class="gaip-enable-shade" checked>
                            <span>Enable Shade Analysis</span>
                        </label>
                    </div>
                    <label>Sky View Factor (0–1)
                        <span class="gaip-tooltip" title="Fraction of sky visible from turf surface. 1.0 = open field, 0.5 = half sky blocked. Stand at centre and estimate % of hemisphere that is open sky.">ⓘ</span>
                    </label>
                    <input type="number" step="0.01" class="gaip-svf-input" value="1" min="0" max="1">

                    <label>Facade obstruction angle (°)
                        <span class="gaip-tooltip" title="Angle from horizontal to top of nearest building/stand. 0° = no obstruction, 45° = building as tall as it is distant, 90° = vertical wall adjacent. Calculate: angle = arctan(height ÷ distance)">ⓘ</span>
                    </label>
                    <input type="number" step="1" class="gaip-facade-angle" value="0" min="0" max="90">

                    <label>Tree / structural occlusion (%)
                        <span class="gaip-tooltip" title="Percentage of remaining direct sunlight blocked by trees, mesh, or structures. 0% = no trees, 50% = moderate canopy, 80%+ = dense shade.">ⓘ</span>
                    </label>
                    <input type="number" step="1" class="gaip-tree-occlusion" value="0" min="0" max="100">
                </div>
            </section>

            <!-- ═══════════════════════════════════════════════════════════════════ -->
            <!-- TRAFFIC & WEAR INPUTS - Enhanced v1.1 (Baker/Gibbs/Adams STRI) -->
            <!-- Only visible for Sports Field turf type -->
            <!-- ═══════════════════════════════════════════════════════════════════ -->
            <section class="gaip-card" data-card="traffic" style="display: none;">
                <div class="gaip-card-header">
                    <h3>Traffic &amp; Wear</h3>
                    <div class="gaip-header-controls">
                        <label class="gaip-module-toggle">
                            <input type="checkbox" class="gaip-enable-turf-traffic" checked>
                            <span>Enable Analysis</span>
                        </label>
                        <span class="gaip-card-toggle">▼</span>
                    </div>
                </div>
                <div class="gaip-card-body">
                    <!-- Context indicator - set by Turf Profile -->
                    <div class="gaip-context-indicator" data-section="wear">
                        Wear recovery engine active for sports fields
                    </div>
                    
                    <!-- Current Soil Moisture -->
                    <div class="gaip-form-row">
                        <label>Current Soil Moisture</label>
                        <select class="gaip-soil-moisture">
                            <option value="dry">Dry</option>
                            <option value="slightly_dry">Slightly Dry</option>
                            <option value="optimal" selected>Optimal</option>
                            <option value="moist">Moist</option>
                            <option value="wet">Wet</option>
                            <option value="saturated">Saturated</option>
                        </select>
                    </div>

                    <!-- Match Schedule -->
                    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
                        <strong style="color: #2c5f2d;">Match Schedule</strong>
                    </div>
                    
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Sport</label>
                            <select class="gaip-match-sport">
                                <option value="soccer">Soccer</option>
                                <option value="afl">AFL</option>
                                <option value="rugby_union">Rugby Union</option>
                                <option value="rugby_league">Rugby League</option>
                            </select>
                        </div>
                        <div>
                            <label>Matches/Week</label>
                            <input type="number" class="gaip-matches-week" value="2" min="0" max="14" step="1">
                        </div>
                    </div>
                    
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Match Duration (hrs)</label>
                            <input type="number" class="gaip-match-duration" value="1.5" min="0.5" max="3" step="0.5">
                        </div>
                        <div>
                            <label>Player Age Group</label>
                            <select class="gaip-age-group">
                                <option value="junior">Junior (U12)</option>
                                <option value="youth">Youth (12-17)</option>
                                <option value="adult" selected>Adult (18-35)</option>
                                <option value="masters">Masters (35+)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="gaip-form-row">
                        <label>Typical Squad Size</label>
                        <select class="gaip-team-size">
                            <option value="small">Small (&lt;15 players)</option>
                            <option value="medium" selected>Medium (15-30 players)</option>
                            <option value="large">Large (30+ players)</option>
                        </select>
                    </div>

                    <!-- Training Schedule -->
                    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
                        <strong style="color: #2c5f2d;">Training Schedule</strong>
                    </div>
                    
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Training Type</label>
                            <select class="gaip-training-type">
                                <option value="training_full">Full Training (match sim)</option>
                                <option value="training_drills" selected>Skills & Drills</option>
                                <option value="training_light">Light Training</option>
                            </select>
                        </div>
                        <div>
                            <label>Sessions/Week</label>
                            <input type="number" class="gaip-sessions-week" value="3" min="0" max="14" step="1">
                        </div>
                    </div>
                    
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Session Duration (hrs)</label>
                            <input type="number" class="gaip-session-duration" value="1.5" min="0.5" max="3" step="0.5">
                        </div>
                        <div>
                            <label>Training Area Used (%)</label>
                            <input type="number" class="gaip-training-rotation" value="100" min="10" max="100" step="5"
                                   title="100% = full pitch used with rotation. 50% = half pitch, concentrated wear on same areas.">
                        </div>
                    </div>
                    
                    <div class="gaip-form-row">
                        <label>Rest Days per Week</label>
                        <input type="number" class="gaip-rest-days" value="2" min="0" max="7" step="1">
                    </div>

                    <!-- Cumulative Stress History -->
                    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
                        <strong style="color: #2c5f2d;">Prior Usage History</strong>
                        <span style="font-size: 11px; color: #666; display: block; margin-top: 4px;">
                            Enter training + match hours from recent weeks to calculate cumulative wear
                        </span>
                    </div>
                    
                    <div class="gaip-form-row-grid gaip-prior-weeks">
                        <div>
                            <label>Last week (hrs)</label>
                            <input type="number" class="gaip-prior-week-1" value="" min="0" max="50" step="0.5" placeholder="—">
                        </div>
                        <div>
                            <label>2 weeks ago (hrs)</label>
                            <input type="number" class="gaip-prior-week-2" value="" min="0" max="50" step="0.5" placeholder="—">
                        </div>
                    </div>
                    <div class="gaip-form-row-grid gaip-prior-weeks">
                        <div>
                            <label>3 weeks ago (hrs)</label>
                            <input type="number" class="gaip-prior-week-3" value="" min="0" max="50" step="0.5" placeholder="—">
                        </div>
                        <div>
                            <label>4 weeks ago (hrs)</label>
                            <input type="number" class="gaip-prior-week-4" value="" min="0" max="50" step="0.5" placeholder="—">
                        </div>
                    </div>

                    <!-- Turf Condition Factors -->
                    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
                        <strong style="color: #2c5f2d;">Turf Condition Factors</strong>
                    </div>
                    
                    <div class="gaip-form-row-grid">
                        <div>
                            <label>Est. Root Depth (mm)</label>
                            <input type="number" class="gaip-root-depth" value="100" min="10" max="300" step="10">
                        </div>
                        <div>
                            <label>Overseed Status</label>
                            <select class="gaip-overseed-status">
                                <option value="none" selected>None / Pure Stand</option>
                                <option value="pre_seed">Pre-seed (planning)</option>
                                <option value="germinating">Germinating (0-2 weeks)</option>
                                <option value="establishing">Establishing (2-4 weeks)</option>
                                <option value="immature">Immature (4-8 weeks)</option>
                                <option value="maturing">Maturing (8-12 weeks)</option>
                                <option value="mature">Mature (12+ weeks)</option>
                                <option value="transitioning">Transitioning (spring)</option>
                                <option value="fading">Fading</option>
                                <option value="dead">Dead (warm-season only)</option>
                            </select>
                        </div>
                    </div>
                    
                </div>
            </section>

        </div>

        <button type="button" class="gaip-run-btn">Run Integrated Analysis</button>
        
        <!-- Export Controls -->
        <div class="gaip-export-controls" style="margin-top: 12px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <button type="button" id="gaip-export-word" class="gaip-export-btn" style="background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                📄 Export to Word
            </button>
            
            <button type="button" id="gaip-whatif-btn" onclick="GilbaScenarioUI.showWhatIfPanel()" style="background: #7c3aed; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                ⚡ What-If Analysis
            </button>
            
            <div class="gaip-logo-upload" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <label style="font-size: 13px; color: #4b5563;">Report Logo:</label>
                <select id="gaip-logo-select" style="font-size: 13px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; max-width: 180px;">
                    <option value="">— None —</option>
                </select>
                <button type="button" id="gaip-logo-add-btn" style="font-size: 12px; padding: 4px 10px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">+ Add</button>
                <button type="button" id="gaip-logo-delete-btn" style="font-size: 12px; padding: 4px 10px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; display: none;">Delete</button>
                <input type="file" id="gaip-logo-upload" accept="image/png,image/jpeg,image/gif" style="display: none;">
                <span id="gaip-logo-status" style="font-size: 12px; color: #6b7280;"></span>
            </div>
            
            <div style="display: flex; align-items: center; gap: 6px;">
                <label for="gaip-org-name" style="font-size: 13px; color: #4b5563;">Organisation:</label>
                <input type="text" id="gaip-org-name" placeholder="Your organisation name" style="padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px; width: 180px;">
            </div>
        </div>
        
        <div class="gaip-status" style="margin: 10px 0; padding: 10px; display: none; border-radius: 4px;"></div>

        <div class="gaip-results" style="display:none;">
            <h3>Integrated Interpretation</h3>
            
            <!-- Climate Status Summary Banner -->
            <div id="gaip-climate-status-banner" class="gaip-climate-banner" style="display:none; margin: 10px 0 20px; padding: 12px 16px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 8px; border-left: 4px solid #0ea5e9;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span id="gaip-climate-icon" style="font-size: 24px;">🌤️</span>
                    <div>
                        <div style="font-weight: 600; color: #0c4a6e; font-size: 14px;">Climate Conditions</div>
                        <div id="gaip-climate-summary" style="color: #0369a1; font-size: 13px;">Loading...</div>
                    </div>
                </div>
            </div>

            <!-- ═══════════════════════════════════════════ -->
            <!-- AGRONOMIC FOUNDATIONS -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #3b82f6;">
                <h3 style="margin: 0; color: #1e40af; font-size: 15px; font-weight: 600;">
                    AGRONOMIC FOUNDATIONS
                </h3>
            </div>

            <div class="gaip-result-block" data-section="mlsn">
                <h4 class="gaip-soil-result-title">Soil nutrient sufficiency</h4>
                <div class="gaip-result-body gaip-mlsn-body"></div>
            </div>

            <div class="gaip-result-block" data-section="nutrient-demand">
                <h4>N-linked nutrient demand</h4>
                <div class="gaip-result-body gaip-nutrient-demand-body"></div>
            </div>

            <div class="gaip-result-block" data-section="tissue">
                <h4>Tissue nutrient interpretation</h4>
                <div class="gaip-result-body gaip-tissue-body"></div>
            </div>

            <div class="gaip-result-block" data-section="water">
                <h4>Irrigation water quality → comprehensive analysis</h4>
                <div class="gaip-result-body gaip-water-body"></div>
            </div>
            
            <!-- ═══════════════════════════════════════════ -->
            <!-- NUTRITION PROGRAM -->
            <!-- GP-weighted calendar + product recommendations -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #16a34a;">
                <h3 style="margin: 0; color: #15803d; font-size: 15px; font-weight: 600;">
                    NUTRITION PROGRAM
                </h3>
            </div>
            
            <div class="gaip-result-block" data-section="nutrition-program">
                <h4>Annual nutrition calendar</h4>
                <div class="gaip-result-body gaip-nutrition-program-body">
                    <!-- Nutrition Calendar Module Container -->
                    <div data-nutrition-calendar-module class="gaip-nutrition-calendar-module">
                        <div class="gaip-nutrition-calendar-intro" style="padding: 16px; background: #f0fdf4; border-radius: 8px; margin-bottom: 16px;">
                            <p style="margin: 0 0 12px 0; color: #166534;">
                                <strong>📅 Generate your annual nutrition program</strong><br>
                                Enter your annual N target - the calculator distributes across the year by growth potential, applies clipping return factors, and calculates P/K/Ca/Mg from research-based ratios.
                            </p>
                            
                            <!-- Primary N Input - Prominent -->
                            <div style="background: white; border: 2px solid #16a34a; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                    <div>
                                        <label style="display: block; font-size: 13px; font-weight: 600; color: #166534; margin-bottom: 6px;">
                                            Annual N Target (kg/ha) <span style="color: #dc2626;">*</span>
                                        </label>
                                        <input type="number" name="annual_n" class="gaip-nutrition-annual-n" placeholder="e.g. 180" min="50" max="500" required style="width: 100%; padding: 10px; border: 2px solid #16a34a; border-radius: 6px; font-size: 16px; font-weight: 600;">
                                        <p style="margin: 6px 0 0; font-size: 11px; color: #666;">
                                            Typical ranges: Greens 80-150 | Tees 120-180 | Sports 180-350
                                        </p>
                                    </div>
                                    <div>
                                        <label style="display: block; font-size: 13px; font-weight: 600; color: #166534; margin-bottom: 6px;">
                                            Max N per Application (kg/ha)
                                        </label>
                                        <input type="number" name="max_n_per_month" class="gaip-nutrition-max-n" value="50" min="10" max="100" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 16px;">
                                        <p style="margin: 6px 0 0; font-size: 11px; color: #666;">
                                            Per month cap. Lower for fine turf, higher for sports.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Secondary Options -->
                            <div class="gaip-nutrition-config" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px;">
                                <div>
                                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Distribution Method</label>
                                    <select name="distribution_method" class="gaip-nutrition-distribution" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
                                        <option value="gp_weighted">GP-Weighted (recommended)</option>
                                        <option value="even">Even monthly distribution</option>
                                        <option value="front_loaded">Front-loaded (spring emphasis)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Clipping Management</label>
                                    <select name="clipping_management" class="gaip-nutrition-clipping" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
                                        <option value="">Auto (based on surface)</option>
                                        <option value="collected">Collected (greens, tees)</option>
                                        <option value="returned">Returned (fairways, sports)</option>
                                    </select>
                                </div>
                            </div>
                            <button type="button" data-nutrition-generate class="gaip-btn gaip-btn-primary" style="background: #16a34a; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                Generate Nutrition Program
                            </button>
                        </div>
                        
                        <!-- Results container (populated by JS) -->
                        <div data-nutrition-results style="display: none;">
                            <div data-nutrition-summary></div>
                            <div data-nutrition-calendar></div>
                            <!-- Prebble recommendations injected here for NZ -->
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- ═══════════════════════════════════════════ -->
            <!-- PERFORMANCE & WEAR -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #10b981;">
                <h3 style="margin: 0; color: #047857; font-size: 15px; font-weight: 600;">
                    PERFORMANCE & WEAR
                </h3>
            </div>

            <div class="gaip-result-block" data-section="traffic">
                <h4>Traffic load vs recovery probability</h4>
                <div class="gaip-result-body gaip-traffic-body"></div>
            </div>
            
            <!-- ═══════════════════════════════════════════ -->
            <!-- GROWTH CONDITIONS -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #8b5cf6;">
                <h3 style="margin: 0; color: #6d28d9; font-size: 15px; font-weight: 600;">
                    GROWTH CONDITIONS
                </h3>
            </div>
            
            <div class="gaip-result-block" data-section="growth">
                <h4>Growth potential analysis</h4>
                <div class="gaip-result-body gaip-growth-body"></div>
            </div>

            <div class="gaip-result-block" data-section="shade">
                <h4>Shade stress + microclimate constraints</h4>
                <div class="gaip-result-body gaip-shade-body"></div>
            </div>
            
            <!-- ═══════════════════════════════════════════ -->
            <!-- PGR & IRRIGATION -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #7c3aed;">
                <h3 style="margin: 0; color: #6d28d9; font-size: 15px; font-weight: 600;">
                    PGR & IRRIGATION
                </h3>
            </div>
            
            <div class="gaip-result-block" data-section="pgr">
                <h4>PGR program status (GDD-based)</h4>
                <div class="gaip-result-body gaip-pgr-body"></div>
            </div>
            
            <div class="gaip-result-block" data-section="sensor" id="gaip-sensor-results-section" style="display: none;">
                <h4>📡 Soil Moisture Sensor Data (TDR)</h4>
                <div class="gaip-result-body gaip-sensor-body"></div>
            </div>
            
            <div class="gaip-result-block" data-section="irrigation">
                <h4>Irrigation scheduling</h4>
                <div class="gaip-result-body gaip-irrigation-body"></div>
            </div>
            
            <!-- ═══════════════════════════════════════════ -->
            <!-- CLIMATE ANALYSIS -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #0ea5e9;">
                <h3 style="margin: 0; color: #0284c7; font-size: 15px; font-weight: 600;">
                    CLIMATE ANALYSIS
                </h3>
            </div>
            
            <div class="gaip-result-block" data-section="climate">
                <h4>Climate conditions & alerts</h4>
                <div class="gaip-result-body gaip-climate-body"></div>
            </div>
            
            <!-- Dew Prediction (Sports Turf Only) -->
            <div class="gaip-result-block gaip-sports-only" data-section="dew" id="gaip-dew-section" style="display: none;">
                <h4>Dew forecast & match conditions</h4>
                <div class="gaip-result-body" id="gaip-dew-output"></div>
            </div>
            
            <!-- ═══════════════════════════════════════════ -->
            <!-- DISEASE RISK -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #ef4444;">
                <h3 style="margin: 0; color: #dc2626; font-size: 15px; font-weight: 600;">
                    DISEASE RISK
                </h3>
            </div>
            
            <div class="gaip-result-block" data-section="disease">
                <h4>Disease pressure & intervention timing</h4>
                <div class="gaip-result-body gaip-disease-body" id="gaip-disease-output"></div>
            </div>
            
            <div class="gaip-result-block" data-section="cultivar">
                <h4>Cultivar performance profile</h4>
                <div class="gaip-result-body gaip-cultivar-body"></div>
            </div>
            
            <!-- ═══════════════════════════════════════════ -->
            <!-- PLANNING TOOLS -->
            <!-- ═══════════════════════════════════════════ -->
            <div style="margin: 20px 0 10px; padding: 8px 0; border-bottom: 2px solid #f59e0b;">
                <h3 style="margin: 0; color: #d97706; font-size: 15px; font-weight: 600;">
                    PLANNING TOOLS
                </h3>
            </div>
            
            <div class="gaip-result-block" data-section="seasonal">
                <h4>Seasonal N planning tool</h4>
                <div class="gaip-result-body gaip-seasonal-body"></div>
            </div>
            
            <div class="gaip-result-block" data-section="calendar">
                <h4>Recovery window calendar</h4>
                <div class="gaip-result-body gaip-calendar-body"></div>
            </div>
            
            <div class="gaip-result-block" data-section="pests">
                <h4>GDD-based pest timing (armyworm, ground pearl)</h4>
                <div class="gaip-result-body gaip-pest-body">Pest timing module not yet active. Link to dedicated GDD calculators.</div>
            </div>
        </div>
    </div>
    
    <?php
    // Close the output buffer for the HTML portion and capture it
    $html_output = ob_get_clean();
    
    // Start a NEW buffer for the script blocks — these will be output 
    // via wp_footer to bypass wptexturize and other content filters
    // that mangle && into &#038; inside <script> tags.
    ob_start();
    ?>
    <script>
    // ============================================
    // LOCATION SEARCH INTEGRATION
    // ============================================
    jQuery(document).ready(function($) {
        let searchTimeout;
        let locationMap = null;
        window.GAIP_LocationMap = null; // exposed reference for venue selector
        let locationMarker = null;
        
        // =============================================
        // LEAFLET MAP PICKER
        // =============================================
        function initMap() {
            var mapEl = document.getElementById('gaip-location-map');
            if (!mapEl || !window.L) return;
            
            var lat = parseFloat($('.gaip-lat').val()) || -33.87;
            var lon = parseFloat($('.gaip-lon').val()) || 151.21;
            var zoom = (lat && lon && lat !== -33.87) ? 15 : 4;
            
            locationMap = L.map('gaip-location-map', {
                scrollWheelZoom: false,   // b35fix205: off by default; lock button toggles
                zoomControl: true
            }).setView([lat, lon], zoom);
            window.GAIP_LocationMap = locationMap;
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 19
            }).addTo(locationMap);
            
            // Add marker if we have valid coordinates
            if (lat && lon && (lat !== -33.87 || lon !== 151.21)) {
                addOrMoveMarker(lat, lon);
            }
            
            // Click map to set location
            locationMap.on('click', function(e) {
                var latlng = e.latlng;
                addOrMoveMarker(latlng.lat, latlng.lng);
                updateLocationFromMap(latlng.lat, latlng.lng);
            });
        }
        
        function addOrMoveMarker(lat, lng) {
            if (!locationMap) return;
            if (locationMarker) {
                locationMarker.setLatLng([lat, lng]);
            } else {
                locationMarker = L.marker([lat, lng], { draggable: true }).addTo(locationMap);
                locationMarker.on('dragend', function(e) {
                    var pos = e.target.getLatLng();
                    updateLocationFromMap(pos.lat, pos.lng);
                });
            }
        }
        window.GAIP_AddOrMoveMarker = addOrMoveMarker;
        
        function updateLocationFromMap(lat, lng) {
            $('.gaip-lat').val(lat.toFixed(4));
            $('.gaip-lon').val(lng.toFixed(4));
            
            // Reverse geocode to get a place name
            reverseGeocode(lat, lng, function(name) {
                if (name) {
                    $('#gaip-location-search').val(name);
                    saveLocation(lat, lng, name);
                    $('#gaip-location-status').text('✓ Location set: ' + name).css('color', '#2c5f2d');
                } else {
                    saveLocation(lat, lng, lat.toFixed(4) + ', ' + lng.toFixed(4));
                    $('#gaip-location-status').text('✓ Location set: ' + lat.toFixed(4) + '°, ' + lng.toFixed(4) + '°').css('color', '#2c5f2d');
                }
            });
            
            // Auto-set hemisphere
            $('select.gaip-hemi').val(lat < 0 ? 'southern' : 'northern');
        }
        
        function reverseGeocode(lat, lng, callback) {
            $.ajax({
                url: GAIP_HUB_CONFIG.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'gilba_reverse_geocode',
                    lat: lat,
                    lon: lng,
                    nonce: GAIP_HUB_CONFIG.nonce
                },
                timeout: 8000,
                success: function(response) {
                    if (response.success && response.data && response.data.name) {
                        callback(response.data.name);
                    } else {
                        callback(null);
                    }
                },
                error: function() { callback(null); }
            });
        }
        
        function syncMapToInputs() {
            var lat = parseFloat($('.gaip-lat').val());
            var lon = parseFloat($('.gaip-lon').val());
            if (!isNaN(lat) && !isNaN(lon) && locationMap) {
                addOrMoveMarker(lat, lon);
                locationMap.setView([lat, lon], 15);
            }
        }
        
        // Initialize map after short delay (ensure DOM + Leaflet ready)
        setTimeout(initMap, 300);
        
        // Sync map when site config restores a different location
        document.addEventListener('gaip:location-restored', function(e) {
            var d = e.detail || {};
            if (d.lat && d.lon && locationMap) {
                addOrMoveMarker(d.lat, d.lon);
                locationMap.setView([d.lat, d.lon], 15);
            }
        });
        
        // =============================================
        // LOCATION SEARCH (existing Nominatim + city fallback)
        // =============================================
        
        $('#gaip-location-search').on('input', function() {
            clearTimeout(searchTimeout);
            const query = $(this).val().trim();
            
            if (query.length < 3) {
                $('#gaip-location-results').hide();
                return;
            }
            
            searchTimeout = setTimeout(function() {
                searchLocation(query);
            }, 500);
        });
        
        // Search using WP-Ajax proxy (existing Nominatim with fallback strategies)
        function searchLocation(query) {
            $('#gaip-location-results').html('<div style="padding: 12px; color: #666;">Searching...</div>').show();
            
            $.ajax({
                url: GAIP_HUB_CONFIG.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'gilba_geocode_search',
                    address: query,
                    nonce: GAIP_HUB_CONFIG.nonce
                },
                success: function(response) {
                    if (response.success && response.data.length > 0) {
                        displayResults(response.data);
                    } else {
                        // City-level fallback: extract likely city/country and try again
                        cityFallbackSearch(query);
                    }
                },
                error: function() {
                    $('#gaip-location-results').html(
                        '<div style="padding: 12px; color: #c41e3a;">Search failed. Please try again or click the map.</div>'
                    );
                }
            });
        }
        
        // Strategy 6 (JS-side): Extract city + country for a city-level result
        function cityFallbackSearch(originalQuery) {
            var parts = originalQuery.split(',').map(function(p) { return p.trim(); });
            // Try to find the city/country from the comma-separated parts
            // Skip parts that look like street addresses or postcodes
            var cityParts = parts.filter(function(p) {
                return !(/^\d/.test(p)) && !(/\b(road|street|drive|avenue|lane|blvd|st|rd|ave|way|crescent|terrace|parade|circuit|close|court|highway|hwy)\b/i.test(p));
            });
            
            if (cityParts.length === 0) cityParts = [parts[parts.length - 1]]; // Use last part as fallback
            var cityQuery = cityParts.join(', ');
            
            if (cityQuery === originalQuery || cityQuery.length < 3) {
                $('#gaip-location-results').html(
                    '<div style="padding: 12px; color: #999;">No exact match found. Try clicking the map directly, or search for the nearest city/suburb.</div>'
                );
                return;
            }
            
            $.ajax({
                url: GAIP_HUB_CONFIG.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'gilba_geocode_search',
                    address: cityQuery,
                    nonce: GAIP_HUB_CONFIG.nonce
                },
                success: function(response) {
                    if (response.success && response.data.length > 0) {
                        // Mark these as approximate
                        response.data.forEach(function(r) { r._approximate = true; });
                        displayResults(response.data, true);
                    } else {
                        $('#gaip-location-results').html(
                            '<div style="padding: 12px; color: #999;">No locations found. Try clicking the map directly, or search for the nearest suburb.</div>'
                        );
                    }
                },
                error: function() {
                    $('#gaip-location-results').html(
                        '<div style="padding: 12px; color: #999;">Search failed. Try clicking the map directly.</div>'
                    );
                }
            });
        }
        
        function escapeHtml(str) {
            var d = document.createElement('div');
            d.appendChild(document.createTextNode(str));
            return d.innerHTML;
        }

        // Display search results
        function displayResults(results, isApproximate) {
            let html = '';
            if (isApproximate) {
                html += '<div style="padding: 8px 12px; background: #fff8e1; font-size: 11px; color: #8a6d3b; border-bottom: 1px solid #eee;">⚠️ Exact address not found. Showing nearest match — click map to refine.</div>';
            }
            results.forEach(function(result, index) {
                var safeName = escapeHtml(String(result.display_name || '').split(',').slice(0, 2).join(','));
                var icon = result._approximate ? '📍~' : '📍';
                html += `
                    <div class="gaip-location-result" data-index="${index}" style="
                        padding: 12px;
                        border-bottom: 1px solid #eee;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">
                        <div style="font-weight: 500; color: #2c5f2d;">${icon} ${safeName}</div>
                        <div style="font-size: 11px; color: #666; font-family: monospace; margin-top: 4px;">
                            ${parseFloat(result.lat).toFixed(4)}°, ${parseFloat(result.lon).toFixed(4)}°
                        </div>
                    </div>
                `;
            });
            
            $('#gaip-location-results').html(html);
            
            // Bind click handlers
            $('.gaip-location-result').on('mouseenter', function() {
                $(this).css('background', '#f0f7f0');
            }).on('mouseleave', function() {
                $(this).css('background', 'white');
            }).on('click', function() {
                const index = $(this).data('index');
                selectLocation(results[index]);
            });
        }
        
        // Select a location
        function selectLocation(location) {
            var lat = parseFloat(location.lat);
            var lon = parseFloat(location.lon);
            
            // Update coordinates
            $('.gaip-lat').val(lat.toFixed(4));
            $('.gaip-lon').val(lon.toFixed(4));
            
            // Update search box
            const shortName = location.display_name.split(',').slice(0, 2).join(',');
            $('#gaip-location-search').val(shortName);
            
            // Hide results
            $('#gaip-location-results').hide();
            
            // Update map
            if (locationMap) {
                addOrMoveMarker(lat, lon);
                locationMap.setView([lat, lon], location._approximate ? 13 : 16);
            }
            
            // Auto-set hemisphere
            $('select.gaip-hemi').val(lat < 0 ? 'southern' : 'northern');
            
            // Save location
            saveLocation(lat, lon, shortName);
            
            if (location._approximate) {
                $('#gaip-location-status').text('⚠️ Approximate — drag pin or click map to refine').css('color', '#8a6d3b');
            }
        }
        
        // Save location to database/session
        function saveLocation(lat, lon, name) {
            $.ajax({
                url: GAIP_HUB_CONFIG.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'gilba_save_location',
                    lat: lat,
                    lon: lon,
                    name: name,
                    nonce: GAIP_HUB_CONFIG.nonce
                },
                success: function(response) {
                    if (response.success) {
                        if (!$('#gaip-location-status').text().includes('Approximate')) {
                            $('#gaip-location-status').text('✓ Location saved: ' + name).css('color', '#2c5f2d');
                        }
                    }
                }
            });
        }
        
        // Close results when clicking outside
        $(document).on('click', function(e) {
            if (!$(e.target).closest('#gaip-location-search, #gaip-location-results').length) {
                $('#gaip-location-results').hide();
            }
        });
        
        // Update map + save when coordinates are changed manually
        $('.gaip-lat, .gaip-lon').on('change', function() {
            const lat = parseFloat($('.gaip-lat').val());
            const lon = parseFloat($('.gaip-lon').val());
            
            if (!isNaN(lat) && !isNaN(lon)) {
                syncMapToInputs();
                saveLocation(lat, lon, $('#gaip-location-search').val());
            }
        });
    });
    </script>
    
    <!-- Site Selector Top Bar handled by site-selector-ui.js -->
    <?php
    $inline_js = ob_get_clean();
    
    // Output the inline JS via wp_footer to bypass wptexturize
    add_action('wp_footer', function() use ($inline_js) {
        echo $inline_js;
    }, 99);

    if ( $hub_mode === 'stadium' ) {
        $html_output .= '<div id="gssh-hub" class="gssh-hub-wrapper"></div>';
    }

    return $html_output;
}
// Prevent wptexturize from converting && to &#038; inside [gaip_hub] shortcode output
add_filter('no_texturize_shortcodes', function($shortcodes) {
    $shortcodes[] = 'gaip_hub';
    return $shortcodes;
});
add_shortcode('gaip_hub', 'gaip_hub_render_shortcode');

// =============================================================================
// FIELD LOG SHORTCODE  [gaip_field_log]
// =============================================================================
// Mobile-first field data capture page.
// Enqueues gaip-field-log.js + gaip-field-log.css only on pages using this
// shortcode. Passes restUrl, restNonce, wpRestUrl, userId via GAIP_FIELD_LOG_CONFIG.
// All observation data is stored in IndexedDB client-side. Spray entries sync
// to /gilba/v1/spray-log when online. Other types remain local until a future
// server-side migration.
// =============================================================================

add_action('wp_enqueue_scripts', function() {
    global $post;
    if (!is_a($post, 'WP_Post') || !has_shortcode($post->post_content, 'gaip_field_log')) {
        return;
    }
    if (!is_user_logged_in()) {
        return;
    }

    $plugin_url = plugin_dir_url(__FILE__);
    $version    = gilba_asset_version( 'assets/gaip-field-log.css' );

    wp_enqueue_style(
        'gaip-field-log',
        $plugin_url . 'assets/gaip-field-log.css',
        array(),
        $version
    );

    // Engine dependencies — must load before gaip-field-log-analysis.js
    wp_enqueue_script(
        'gaip-disease-engine-pure',
        $plugin_url . 'assets/disease-engine-pure.js',
        array(),
        $version,
        true
    );

    wp_enqueue_script(
        'gaip-pgr-module',
        $plugin_url . 'assets/gilba-pgr-module-v3.js',
        array(),
        $version,
        true
    );

    // Sample manager — provides GAIP_SampleManager.getSiteList() for site dropdown
    wp_enqueue_script(
        'gaip-sample-manager',
        $plugin_url . 'assets/sample-manager.js',
        array(),
        $version,
        true
    );

    wp_enqueue_script(
        'gaip-sample-persistence',
        $plugin_url . 'assets/sample-persistence.js',
        array('gaip-sample-manager'),
        $version,
        true
    );

    // Standalone analysis — fetches weather + runs GP + disease + PGR
    wp_enqueue_script(
        'gaip-field-log-analysis',
        $plugin_url . 'assets/gaip-field-log-analysis.js',
        array('gaip-disease-engine-pure', 'gaip-pgr-module', 'gaip-sample-persistence'),
        $version,
        true
    );

    // Main field log UI — depends on analysis + sample manager being loaded
    wp_enqueue_script(
        'gaip-field-log',
        $plugin_url . 'assets/gaip-field-log.js',
        array('gaip-field-log-analysis', 'gaip-sample-manager'),
        $version,
        true       // footer
    );

    wp_localize_script(
        'gaip-field-log',
        'GAIP_FIELD_LOG_CONFIG',
        array(
            'restUrl'    => rest_url('gilba/v1/'),
            'wpRestUrl'  => rest_url('wp/v2'),
            'restNonce'  => wp_create_nonce('wp_rest'),
            'nonce'      => wp_create_nonce('gilba_hub_nonce'), // required by gilba_sites_load AJAX action
            'ajaxUrl'    => admin_url('admin-ajax.php'),
            'userId'     => get_current_user_id(),
            'siteUrl'    => get_site_url(),
        )
    );
});

function gaip_field_log_render_shortcode($atts) {
    if (!is_user_logged_in()) {
        return '<div class="gaip-fl-login-notice" style="padding:20px;text-align:center;">'
             . '<p>Please <a href="' . esc_url(wp_login_url(get_permalink())) . '">log in</a> to use the Field Log.</p>'
             . '</div>';
    }

    $atts = shortcode_atts(array(
        'title' => 'Field Log',
    ), $atts, 'gaip_field_log');

    ob_start();
    ?>
    <div id="gaip-field-log">

        <div class="gaip-fl-header">
            <span class="gaip-fl-header__title">
                <?php echo esc_html($atts['title']); ?>
            </span>
            <span class="gaip-fl-header__logo">Gilba Solutions</span>
        </div>

        <div class="gaip-fl-site-bar" id="gaip-fl-site-bar">
            <!-- Populated by gaip-field-log.js -->
        </div>

        <div class="gaip-fl-badge-bar" id="gaip-fl-badge-bar">
            <!-- Online/offline badge — populated by JS -->
        </div>

        <div class="gaip-fl-tiles" id="gaip-fl-tiles">
            <!-- Status tiles — populated by JS after analysis -->
        </div>

        <div class="gaip-fl-type-nav" id="gaip-fl-type-nav" role="tablist" aria-label="Observation type">
            <!-- Type nav buttons — populated by JS -->
        </div>

        <div class="gaip-fl-form-section">
            <div class="gaip-fl-section-title">New observation</div>
            <div id="gaip-fl-form">
                <!-- Form fields — populated by JS -->
            </div>
        </div>

        <div class="gaip-fl-recent-section">
            <div class="gaip-fl-section-title">Recent — this site</div>
            <div id="gaip-fl-recent">
                <!-- Recent observations — populated by JS -->
            </div>
        </div>

        <div class="gaip-fl-save-bar">
            <button id="gaip-fl-save" type="button">Save</button>
        </div>

    </div>
    <?php
    return ob_get_clean();
}

add_shortcode('gaip_field_log', 'gaip_field_log_render_shortcode');

// Prevent wptexturize inside [gaip_field_log] output
add_filter('no_texturize_shortcodes', function($shortcodes) {
    $shortcodes[] = 'gaip_field_log';
    return $shortcodes;
});

// =============================================================================
// MORNING BRIEFING SHORTCODE  [gaip_morning_briefing]
// =============================================================================

/**
 * Enqueue morning briefing script on any page/post that contains the shortcode.
 * Depends on: gilba-storage-ns, gaip-sample-manager (loaded by gaip_hub on the
 * same page, or standalone when the briefing is on its own page).
 */
function gaip_morning_briefing_enqueue_assets() {
    global $post;
    if ( ! is_a( $post, 'WP_Post' ) ) {
        return;
    }
    // has_shortcode() can miss Gutenberg shortcode blocks — use strpos as fallback
    $has_briefing = has_shortcode( $post->post_content, 'gaip_morning_briefing' )
                 || ( strpos( $post->post_content, 'gaip_morning_briefing' ) !== false );
    if ( ! $has_briefing ) {
        return;
    }

    $plugin_url = plugins_url( '', __FILE__ );

    // Storage namespace shim — must be first
    wp_enqueue_script(
        'gilba-storage-ns',
        $plugin_url . '/assets/gilba-storage-ns.js',
        array(),
        gilba_asset_version( 'assets/gilba-storage-ns.js' ),
        true
    );
    wp_add_inline_script( 'gilba-storage-ns', 'window.GILBA_PLUGIN_NS = "gaip";', 'before' );

    // Sample manager — needed for getSiteList() / getActiveSiteId()
    // Only register if not already enqueued by gaip_hub on the same page
    if ( ! wp_script_is( 'gaip-sample-manager', 'enqueued' ) ) {
        wp_enqueue_script(
            'gaip-sample-manager',
            $plugin_url . '/assets/sample-manager.js',
            array( 'gilba-storage-ns' ),
            gilba_asset_version( 'assets/sample-manager.js' ),
            true
        );
    }

    // PGR module — needed for suppression % calculation per site card
    if ( ! wp_script_is( 'gaip-pgr-module', 'enqueued' ) ) {
        wp_enqueue_script(
            'gaip-pgr-module',
            $plugin_url . '/assets/gilba-pgr-module-v3.js',
            array( 'gilba-storage-ns' ),
            gilba_asset_version( 'assets/gilba-pgr-module-v3.js' ),
            true
        );
    }

    // Morning briefing module
    wp_enqueue_script(
        'gaip-morning-briefing',
        $plugin_url . '/assets/gaip-morning-briefing.js',
        array( 'gilba-storage-ns', 'gaip-sample-manager' ),
        gilba_asset_version( 'assets/gaip-morning-briefing.js' ),
        true
    );

    // Pass hub config so briefing can use userId (cache key) and hubUrl (Open in hub link)
    $hub_url = '';
    // Try to find the page that contains [gaip_hub] and use its permalink
    $hub_pages = get_posts( array(
        'post_type'   => array( 'page', 'post' ),
        'post_status' => 'publish',
        's'           => 'gaip_hub',
        'numberposts' => 5,
    ) );
    foreach ( $hub_pages as $hp ) {
        if ( has_shortcode( $hp->post_content, 'gaip_hub' ) ) {
            $hub_url = get_permalink( $hp->ID );
            break;
        }
    }

    wp_add_inline_script( 'gaip-morning-briefing',
        'window.GAIP_HUB_CONFIG = window.GAIP_HUB_CONFIG || {};'
        . 'window.GAIP_HUB_CONFIG.userId = ' . (int) get_current_user_id() . ';'
        . 'window.GAIP_HUB_CONFIG.hubUrl = ' . wp_json_encode( $hub_url ) . ';',
        'before'
    );
}
add_action( 'wp_enqueue_scripts', 'gaip_morning_briefing_enqueue_assets' );

/**
 * Render [gaip_morning_briefing] shortcode.
 * Outputs a container div; all content is populated by gaip-morning-briefing.js.
 *
 * @param array $atts  title (optional)
 */
function gaip_morning_briefing_render_shortcode( $atts ) {
    if ( ! is_user_logged_in() ) {
        return '<div style="padding:20px;text-align:center;">'
             . '<p>Please <a href="' . esc_url( wp_login_url( get_permalink() ) ) . '">log in</a> to view the Morning Briefing.</p>'
             . '</div>';
    }

    $atts = shortcode_atts( array(
        'title' => 'Morning Briefing',
    ), $atts, 'gaip_morning_briefing' );

    ob_start();
    ?>
    <div id="gaip-morning-briefing" style="font-family:system-ui,sans-serif;padding:0;">
        <!-- Populated by gaip-morning-briefing.js -->
        <div style="padding:20px;color:#94a3b8;font-size:0.9em;">Loading briefing...</div>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode( 'gaip_morning_briefing', 'gaip_morning_briefing_render_shortcode' );

// Prevent wptexturize inside [gaip_morning_briefing] output
add_filter( 'no_texturize_shortcodes', function( $shortcodes ) {
    $shortcodes[] = 'gaip_morning_briefing';
    return $shortcodes;
} );
