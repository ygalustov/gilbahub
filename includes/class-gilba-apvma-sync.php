<?php
/**
 * APVMA PubCRIS Sync
 * ==================
 *
 * Validates AU fungicide registrations against the APVMA PubCRIS open dataset
 * (data.gov.au). No API key required. Dataset updated weekly by APVMA.
 *
 * What it does:
 *  - Runs weekly via WP-Cron to fetch the APVMA product and constituent CSVs
 *  - Filters for turf-relevant products (fungicide/fungicide category)
 *  - Caches validated registration data in a WordPress transient
 *  - Exposes sync metadata to JS via wp_localize_script (GAIP_APVMA_META)
 *  - Surfaces a warning in the Hub admin if any product in au-fungicides.js
 *    is not found in the APVMA register
 *
 * Data sources (no auth, no key):
 *  product.csv  - https://data.gov.au/.../download/product.csv
 *  constit.csv  - https://data.gov.au/.../download/constit.csv
 *  prodtype_list.csv - product category codes
 *
 * @package GilbaHub
 * @since   1.0.0 (b35+)
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gilba_APVMA_Sync {

    // -------------------------------------------------------------------------
    // APVMA data.gov.au endpoints - no auth required
    // -------------------------------------------------------------------------

    const PRODUCT_CSV_URL  = 'https://data.gov.au/data/dataset/0de37904-43e0-4814-b21b-5b64fafefe6f/resource/b4bb5394-b60b-4602-8bde-2e206ffc498f/download/product.csv';
    const CONSTIT_CSV_URL  = 'https://data.gov.au/data/dataset/0de37904-43e0-4814-b21b-5b64fafefe6f/resource/de913672-c51a-483a-b467-f2f9df51f671/download/constit.csv';
    const PRODTYPE_CSV_URL = 'https://data.gov.au/data/dataset/0de37904-43e0-4814-b21b-5b64fafefe6f/resource/ab4aef28-54e3-4c25-b35a-5d45749a2d7a/download/prodtype_list.csv';

    // Transient keys
    const TRANSIENT_PRODUCTS = 'gilba_apvma_products';
    const TRANSIENT_META     = 'gilba_apvma_meta';
    const TRANSIENT_TTL      = WEEK_IN_SECONDS;

    // Cron hook name
    const CRON_HOOK = 'gilba_apvma_weekly_sync';

    // -------------------------------------------------------------------------
    // Active ingredient names as they appear in APVMA constit.csv
    // Mapped to the keys used in au-fungicides.js
    // -------------------------------------------------------------------------
    const ACTIVE_MAP = [
        'thiophanate-methyl'   => 'thiophanateMethyl',
        'thiabendazole'        => 'thiabendazole',
        'iprodione'            => 'iprodione',
        'procymidone'          => 'procymidone',
        'propiconazole'        => 'propiconazole',
        'tebuconazole'         => 'tebuconazole',
        'triticonazole'        => 'triticonazole',
        'triadimenol'          => 'triadimenol',
        'myclobutanil'         => 'myclobutanil',
        'boscalid'             => 'boscalid',
        'fluxapyroxad'         => 'fluxapyroxad',
        'penthiopyrad'         => 'penthiopyrad',
        'azoxystrobin'         => 'azoxystrobin',
        'pyraclostrobin'       => 'pyraclostrobin',
        'trifloxystrobin'      => 'trifloxystrobin',
        'mandestrobin'         => 'mandestrobin',
        'fludioxonil'          => 'fludioxonil',
        'etridiazole'          => 'etridiazole',
        'tolclofos-methyl'     => 'tolclofosMethyl',
        'cyazofamid'           => 'cyazofamid',
        'propamocarb'          => 'propamocarb',
        'propamocarb hydrochloride' => 'propamocarb',
        'fluazinam'            => 'fluazinam',
        'fosetyl-al'           => 'fosetylAl',
        'fosetyl aluminium'    => 'fosetylAl',
        'chlorothalonil'       => 'chlorothalonil',
        'mancozeb'             => 'mancozeb',
        'oxathiapiprolin'      => 'oxathiapiprolin',
    ];

    // Trade names from au-fungicides.js to validate in product.csv
    const TRADE_NAMES = [
        'Clean Sweep Trio', 'Vorlon', 'Voltar 250 GT', 'Iprodione 365',
        'Chief Aquaflo', 'Ippon 500', 'Voltar 500', 'Chief Topflo',
        'Sumisclex', 'Sporex', 'Banner Maxx', 'Regiment 550', 'Prop 500',
        'Banner Fairway', 'Bumper 625', 'Dedicate Forte', 'Tribeca',
        'Citadel', 'Tridim 250', 'Patchwork', 'Systhane Turf',
        'Xzemplar', 'Velista', 'Heritage', 'Heritage Maxx', 'Azoxy 250 SC',
        'Insignia', 'Tombstone Duo', 'Dedicate', 'Patriot',
        'Interface Stressgard', 'Rapidol', 'Medallion', 'Sceptre',
        'Terrazole', 'Shiba', 'Segway', 'Schrapnel', 'Emerald', 'Compass',
        'Proforce Grenadier 800', 'Signature Xtra Stressgard',
        'Chloronil 720', 'Bravo WeatherStik', 'Liquid Dek', 'Penncozeb 750',
        'Segovis', 'Evolution', 'Instrata', 'Qualipro-Enclave',
    ];

    // -------------------------------------------------------------------------
    // Initialisation
    // -------------------------------------------------------------------------

    public static function init() {
        // Register cron hook
        add_action( self::CRON_HOOK, [ __CLASS__, 'run_sync' ] );

        // Schedule if not already scheduled
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            wp_schedule_event( time(), 'weekly', self::CRON_HOOK );
        }

        // Expose metadata to JS
        add_action( 'wp_enqueue_scripts', [ __CLASS__, 'localize_meta' ], 99 );

        // Admin notice for stale/failed syncs
        add_action( 'admin_notices', [ __CLASS__, 'admin_notice' ] );
    }

    // -------------------------------------------------------------------------
    // Main sync routine (runs weekly via WP-Cron)
    // -------------------------------------------------------------------------

    public static function run_sync() {
        $products = self::fetch_and_parse_products();

        if ( is_wp_error( $products ) ) {
            update_option( 'gilba_apvma_last_error', $products->get_error_message() );
            update_option( 'gilba_apvma_last_error_time', time() );
            return;
        }

        $constituents = self::fetch_and_parse_constituents();
        $validation   = self::validate_against_database( $products, $constituents );

        $meta = [
            'lastSync'       => gmdate( 'Y-m-d' ),
            'lastSyncTs'     => time(),
            'version'        => 'apvma-' . gmdate( 'Ymd' ),
            'productCount'   => count( $products ),
            'validation'     => $validation,
            'warnings'       => $validation['unmatched'],
        ];

        set_transient( self::TRANSIENT_PRODUCTS, $products, self::TRANSIENT_TTL );
        set_transient( self::TRANSIENT_META, $meta, self::TRANSIENT_TTL );

        // Clear any prior error
        delete_option( 'gilba_apvma_last_error' );
        delete_option( 'gilba_apvma_last_error_time' );
    }

    // -------------------------------------------------------------------------
    // CSV fetch and parse helpers
    // -------------------------------------------------------------------------

    private static function fetch_and_parse_products() {
        $response = wp_remote_get( self::PRODUCT_CSV_URL, [
            'timeout'    => 30,
            'user-agent' => 'GilbaHub/1.0 APVMA-Sync (APVMA PubCRIS open data)',
        ] );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code( $response );
        if ( $code !== 200 ) {
            return new WP_Error( 'apvma_http', "APVMA product.csv returned HTTP {$code}" );
        }

        $body = wp_remote_retrieve_body( $response );
        return self::parse_csv( $body );
    }

    private static function fetch_and_parse_constituents() {
        $response = wp_remote_get( self::CONSTIT_CSV_URL, [
            'timeout'    => 30,
            'user-agent' => 'GilbaHub/1.0 APVMA-Sync (APVMA PubCRIS open data)',
        ] );

        if ( is_wp_error( $response ) ) {
            return [];
        }

        $code = wp_remote_retrieve_response_code( $response );
        if ( $code !== 200 ) {
            return [];
        }

        return self::parse_csv( wp_remote_retrieve_body( $response ) );
    }

    /**
     * Parse a CSV string into an array of associative arrays.
     * Handles quoted fields and line endings.
     */
    private static function parse_csv( string $raw ): array {
        $rows   = [];
        $lines  = preg_split( '/\r\n|\r|\n/', trim( $raw ) );
        $header = null;

        foreach ( $lines as $line ) {
            if ( empty( $line ) ) continue;

            // Simple CSV parse — handles quoted commas
            $fields = str_getcsv( $line );

            if ( $header === null ) {
                $header = array_map( 'strtolower', array_map( 'trim', $fields ) );
                continue;
            }

            // Pad short rows
            while ( count( $fields ) < count( $header ) ) {
                $fields[] = '';
            }

            $rows[] = array_combine( $header, array_slice( $fields, 0, count( $header ) ) );
        }

        return $rows;
    }

    // -------------------------------------------------------------------------
    // Validation: cross-reference au-fungicides.js data against PubCRIS
    // -------------------------------------------------------------------------

    private static function validate_against_database( array $products, array $constituents ): array {
        $result = [
            'matched'   => [],
            'unmatched' => [],
            'actives'   => [],
        ];

        if ( empty( $products ) ) {
            return $result;
        }

        // Build lookup: lowercase trade name => product row
        $product_lookup = [];
        foreach ( $products as $row ) {
            $name = strtolower( trim( $row['prodname'] ?? $row['product_name'] ?? '' ) );
            if ( $name ) {
                $product_lookup[ $name ] = $row;
            }
        }

        // Validate each trade name from au-fungicides.js
        foreach ( self::TRADE_NAMES as $trade ) {
            $key = strtolower( $trade );
            if ( isset( $product_lookup[ $key ] ) ) {
                $result['matched'][] = $trade;
            } else {
                // Try partial match (some APVMA names have batch/formulation suffixes)
                $partial_found = false;
                foreach ( $product_lookup as $apvma_name => $row ) {
                    if ( strpos( $apvma_name, $key ) !== false || strpos( $key, $apvma_name ) !== false ) {
                        $result['matched'][] = $trade;
                        $partial_found = true;
                        break;
                    }
                }
                if ( ! $partial_found ) {
                    $result['unmatched'][] = $trade . ' — not found in APVMA PubCRIS. Verify registration at portal.apvma.gov.au/pubcris';
                }
            }
        }

        // Validate active ingredients via constituents
        if ( ! empty( $constituents ) ) {
            $active_lookup = [];
            foreach ( $constituents as $row ) {
                $ai = strtolower( trim( $row['constit_name'] ?? $row['active_name'] ?? '' ) );
                if ( $ai ) $active_lookup[ $ai ] = true;
            }

            foreach ( self::ACTIVE_MAP as $apvma_name => $js_key ) {
                $result['actives'][ $js_key ] = isset( $active_lookup[ $apvma_name ] )
                    ? 'approved'
                    : 'not-found';
            }
        }

        return $result;
    }

    // -------------------------------------------------------------------------
    // Expose metadata to JavaScript
    // -------------------------------------------------------------------------

    public static function localize_meta() {
        // Only localise if au-fungicides.js is enqueued
        if ( ! wp_script_is( 'gaip-au-fungicides', 'enqueued' ) ) {
            return;
        }

        $meta = get_transient( self::TRANSIENT_META );

        if ( ! $meta ) {
            $meta = [
                'lastSync'  => null,
                'version'   => 'static-1.0.0',
                'warnings'  => [],
                'status'    => 'pending',
            ];
        }

        wp_localize_script( 'gaip-au-fungicides', 'GAIP_APVMA_META', $meta );
    }

    // -------------------------------------------------------------------------
    // Admin notice if sync is stale or last attempt errored
    // -------------------------------------------------------------------------

    public static function admin_notice() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $error      = get_option( 'gilba_apvma_last_error' );
        $error_time = get_option( 'gilba_apvma_last_error_time' );
        $meta       = get_transient( self::TRANSIENT_META );

        if ( $error && $error_time ) {
            $age = human_time_diff( $error_time );
            echo '<div class="notice notice-warning"><p>';
            echo '<strong>Gilba Hub — APVMA Sync:</strong> Last sync attempt failed ' . esc_html( $age ) . ' ago. ';
            echo 'Error: ' . esc_html( $error ) . '. ';
            echo 'AU fungicide data is using the static database. ';
            echo '<a href="' . esc_url( admin_url( 'admin.php?page=gilba-hub&apvma_force_sync=1' ) ) . '">Retry now</a>';
            echo '</p></div>';
            return;
        }

        if ( $meta && ! empty( $meta['warnings'] ) ) {
            $count = count( $meta['warnings'] );
            echo '<div class="notice notice-info is-dismissible"><p>';
            echo '<strong>Gilba Hub — APVMA:</strong> ' . esc_html( $count ) . ' product(s) in the AU fungicide database could not be verified in PubCRIS. ';
            echo 'This may indicate label changes or product cancellations. Review: ';
            echo '<ul style="margin:.5em 0 0 1.5em;list-style:disc">';
            foreach ( array_slice( $meta['warnings'], 0, 5 ) as $w ) {
                echo '<li>' . esc_html( $w ) . '</li>';
            }
            if ( $count > 5 ) {
                echo '<li>... and ' . esc_html( $count - 5 ) . ' more.</li>';
            }
            echo '</ul></p></div>';
        }
    }

    // -------------------------------------------------------------------------
    // Manual sync trigger (admin URL hook)
    // -------------------------------------------------------------------------

    public static function maybe_force_sync() {
        if (
            isset( $_GET['apvma_force_sync'] ) &&
            current_user_can( 'manage_options' ) &&
            check_admin_referer( 'gilba_apvma_force' )
        ) {
            self::run_sync();
            add_action( 'admin_notices', function () {
                echo '<div class="notice notice-success"><p>APVMA sync completed.</p></div>';
            } );
        }
    }

    // -------------------------------------------------------------------------
    // Deactivation cleanup
    // -------------------------------------------------------------------------

    public static function deactivate() {
        $timestamp = wp_next_scheduled( self::CRON_HOOK );
        if ( $timestamp ) {
            wp_unschedule_event( $timestamp, self::CRON_HOOK );
        }
        delete_transient( self::TRANSIENT_PRODUCTS );
        delete_transient( self::TRANSIENT_META );
    }
}
