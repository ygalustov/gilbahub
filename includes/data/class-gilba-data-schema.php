<?php
/**
 * Gilba Data Layer — Schema bootstrap (b35fix301b)
 *
 * Creates/updates the six foundation tables for the standalone data layer
 * that will eventually live in a sibling plugin. Namespace is deliberately
 * `Gilba_Data_*` with files under includes/data/ to make that extraction
 * a mechanical move later.
 *
 * Tables (all InnoDB, utf8mb4):
 *   - {prefix}gilba_data_accounts
 *   - {prefix}gilba_data_precinct_groups
 *   - {prefix}gilba_data_sites
 *   - {prefix}gilba_data_samples
 *   - {prefix}gilba_data_spray_log
 *   - {prefix}gilba_data_site_summaries
 *
 * FK behaviour:
 *   samples / spray_log       → ON DELETE RESTRICT (historical integrity)
 *   site_summaries / precinct_groups → ON DELETE CASCADE (derived / owned)
 *
 * Activation is fully idempotent — dbDelta is safe to re-run.
 *
 * @package Gilba_Hub
 * @since   b35fix301b
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

if ( ! defined( 'GILBA_DATA_SCHEMA_VERSION' ) ) {
    define( 'GILBA_DATA_SCHEMA_VERSION', '1.1.0' );
}

class Gilba_Data_Schema {

    const OPTION_SCHEMA_VERSION = 'gilba_data_schema_version';

    /**
     * Canonical table name helpers. All external callers should route through
     * these so the sibling-plugin extraction is a find/replace job.
     */
    public static function table( $name ) {
        global $wpdb;
        $map = array(
            'accounts'         => $wpdb->prefix . 'gilba_data_accounts',
            'precinct_groups'  => $wpdb->prefix . 'gilba_data_precinct_groups',
            'sites'            => $wpdb->prefix . 'gilba_data_sites',
            'samples'          => $wpdb->prefix . 'gilba_data_samples',
            'spray_log'        => $wpdb->prefix . 'gilba_data_spray_log',
            'site_summaries'   => $wpdb->prefix . 'gilba_data_site_summaries',
        );
        return isset( $map[ $name ] ) ? $map[ $name ] : '';
    }

    /**
     * Plugin activation hook. Runs dbDelta for all six tables and stores
     * the schema version in wp_options so future migrations can branch.
     */
    public static function activate() {
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();

        $t_accounts        = self::table( 'accounts' );
        $t_precinct_groups = self::table( 'precinct_groups' );
        $t_sites           = self::table( 'sites' );
        $t_samples         = self::table( 'samples' );
        $t_spray_log       = self::table( 'spray_log' );
        $t_summaries       = self::table( 'site_summaries' );

        // -------- accounts --------
        // One per WP user; holds defaults used when a site has no override.
        $sql_accounts = "CREATE TABLE {$t_accounts} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            owner_user_id BIGINT UNSIGNED NOT NULL,
            display_name VARCHAR(191) NOT NULL DEFAULT '',
            methodology VARCHAR(32) NOT NULL DEFAULT 'mlsn',
            soil_texture VARCHAR(32) NOT NULL DEFAULT 'loam',
            country CHAR(2) NOT NULL DEFAULT 'AU',
            region VARCHAR(64) NOT NULL DEFAULT '',
            settings_json LONGTEXT NULL,
            created_by_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            modified_by_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            updated_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            deleted_at DATETIME NULL DEFAULT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY uq_owner_user (owner_user_id),
            KEY idx_deleted (deleted_at)
        ) ENGINE=InnoDB {$charset_collate};";

        // -------- precinct_groups --------
        // Controlled vocabulary per account (e.g. "West/Central/East" for a council).
        $sql_precinct_groups = "CREATE TABLE {$t_precinct_groups} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            account_id BIGINT UNSIGNED NOT NULL,
            name VARCHAR(128) NOT NULL,
            slug VARCHAR(128) NOT NULL DEFAULT '',
            sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            created_by_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            modified_by_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            updated_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            deleted_at DATETIME NULL DEFAULT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY uq_account_slug (account_id, slug),
            KEY idx_account (account_id),
            KEY idx_deleted (deleted_at)
        ) ENGINE=InnoDB {$charset_collate};";

        // -------- sites --------
        // A precinct or venue. UUID is the stable external ID (Option X).
        // methodology_override NULL → inherit from account.
        $sql_sites = "CREATE TABLE {$t_sites} (
            id CHAR(36) NOT NULL,
            account_id BIGINT UNSIGNED NOT NULL,
            precinct_group_id BIGINT UNSIGNED NULL DEFAULT NULL,
            parent_site_id CHAR(36) NULL DEFAULT NULL,
            name VARCHAR(191) NOT NULL,
            site_type VARCHAR(32) NOT NULL DEFAULT 'precinct',
            latitude DECIMAL(9,6) NULL DEFAULT NULL,
            longitude DECIMAL(9,6) NULL DEFAULT NULL,
            methodology_override VARCHAR(32) NULL DEFAULT NULL,
            soil_texture_override VARCHAR(32) NULL DEFAULT NULL,
            attributes_json LONGTEXT NULL,
            created_by_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            modified_by_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            updated_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            deleted_at DATETIME NULL DEFAULT NULL,
            PRIMARY KEY  (id),
            KEY idx_account (account_id),
            KEY idx_precinct_group (precinct_group_id),
            KEY idx_parent (parent_site_id),
            KEY idx_deleted (deleted_at),
            KEY idx_site_type (site_type)
        ) ENGINE=InnoDB {$charset_collate};";

        // -------- samples --------
        // Unified table for soil/water/tissue/loi. Snapshots of methodology
        // and soil_texture at write time preserve historical interpretation.
        $sql_samples = "CREATE TABLE {$t_samples} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            account_id BIGINT UNSIGNED NOT NULL,
            site_id CHAR(36) NOT NULL,
            sample_type VARCHAR(16) NOT NULL,
            lab_name VARCHAR(128) NOT NULL DEFAULT '',
            lab_ref VARCHAR(64) NOT NULL DEFAULT '',
            sample_date DATE NULL DEFAULT NULL,
            lab_date DATE NULL DEFAULT NULL,
            depth_mm SMALLINT UNSIGNED NULL DEFAULT NULL,
            methodology_snapshot VARCHAR(32) NOT NULL DEFAULT '',
            soil_texture_snapshot VARCHAR(32) NOT NULL DEFAULT '',
            payload_json LONGTEXT NOT NULL,
            notes TEXT NULL,
            created_by_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            modified_by_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            updated_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            deleted_at DATETIME NULL DEFAULT NULL,
            PRIMARY KEY  (id),
            KEY idx_account (account_id),
            KEY idx_site (site_id),
            KEY idx_site_type_date (site_id, sample_type, lab_date),
            KEY idx_sample_type (sample_type),
            KEY idx_deleted (deleted_at)
        ) ENGINE=InnoDB {$charset_collate};";

        // -------- spray_log --------
        // Precinct-level entries; applied_to_samples_json scopes individual
        // pitches (Option A). Primary site_id is the precinct the record belongs to.
        $sql_spray_log = "CREATE TABLE {$t_spray_log} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            account_id BIGINT UNSIGNED NOT NULL,
            site_id CHAR(36) NOT NULL,
            applied_to_site_ids_json LONGTEXT NULL,
            applied_to_samples_json LONGTEXT NULL,
            event_date DATE NOT NULL,
            event_time TIME NULL DEFAULT NULL,
            product_name VARCHAR(191) NOT NULL DEFAULT '',
            product_type VARCHAR(32) NOT NULL DEFAULT '',
            active_ingredient VARCHAR(191) NOT NULL DEFAULT '',
            rate_value DECIMAL(12,4) NULL DEFAULT NULL,
            rate_unit VARCHAR(16) NOT NULL DEFAULT '',
            area_treated_ha DECIMAL(10,4) NULL DEFAULT NULL,
            water_rate_l_per_ha DECIMAL(8,2) NULL DEFAULT NULL,
            operator VARCHAR(128) NOT NULL DEFAULT '',
            conditions_json LONGTEXT NULL,
            notes TEXT NULL,
            created_by_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            modified_by_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            updated_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            deleted_at DATETIME NULL DEFAULT NULL,
            PRIMARY KEY  (id),
            KEY idx_account (account_id),
            KEY idx_site_date (site_id, event_date),
            KEY idx_event_date (event_date),
            KEY idx_product_type (product_type),
            KEY idx_deleted (deleted_at)
        ) ENGINE=InnoDB {$charset_collate};";

        // -------- site_summaries --------
        // Ring-buffered snapshots (N=12 per site/sample_type), dedup by lab_date.
        // Dedup enforced at application layer; unique key guards against races.
        $sql_summaries = "CREATE TABLE {$t_summaries} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            account_id BIGINT UNSIGNED NOT NULL,
            site_id CHAR(36) NOT NULL,
            sample_type VARCHAR(16) NOT NULL,
            lab_date DATE NOT NULL,
            methodology_snapshot VARCHAR(32) NOT NULL DEFAULT '',
            summary_json LONGTEXT NOT NULL,
            source_sample_id BIGINT UNSIGNED NULL DEFAULT NULL,
            created_by_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            modified_by_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            updated_at DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
            deleted_at DATETIME NULL DEFAULT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY uq_site_type_date (site_id, sample_type, lab_date),
            KEY idx_account (account_id),
            KEY idx_site_type (site_id, sample_type),
            KEY idx_deleted (deleted_at)
        ) ENGINE=InnoDB {$charset_collate};";

        dbDelta( $sql_accounts );
        dbDelta( $sql_precinct_groups );
        dbDelta( $sql_sites );
        dbDelta( $sql_samples );
        dbDelta( $sql_spray_log );
        dbDelta( $sql_summaries );

        // FK constraints — dbDelta does not handle these, so we add them
        // after the fact, idempotently. Wrapped in suppress_errors to avoid
        // noise when constraints already exist.
        self::ensure_foreign_keys();

        update_option( self::OPTION_SCHEMA_VERSION, GILBA_DATA_SCHEMA_VERSION, false );
    }

    /**
     * Add FK constraints idempotently. dbDelta doesn't manage them, so we
     * check information_schema before attempting to add.
     *
     * Constraints:
     *   precinct_groups.account_id       → accounts.id              CASCADE
     *   sites.account_id                 → accounts.id              RESTRICT
     *   sites.precinct_group_id          → precinct_groups.id       SET NULL
     *   samples.account_id               → accounts.id              RESTRICT
     *   samples.site_id                  → sites.id                 RESTRICT
     *   spray_log.account_id             → accounts.id              RESTRICT
     *   spray_log.site_id                → sites.id                 RESTRICT
     *   site_summaries.account_id        → accounts.id              CASCADE
     *   site_summaries.site_id           → sites.id                 CASCADE
     */
    private static function ensure_foreign_keys() {
        global $wpdb;

        $constraints = array(
            array(
                'table'   => self::table( 'precinct_groups' ),
                'name'    => 'fk_gilba_data_precinct_groups_account',
                'column'  => 'account_id',
                'ref'     => self::table( 'accounts' ),
                'ref_col' => 'id',
                'on_del'  => 'CASCADE',
            ),
            array(
                'table'   => self::table( 'sites' ),
                'name'    => 'fk_gilba_data_sites_account',
                'column'  => 'account_id',
                'ref'     => self::table( 'accounts' ),
                'ref_col' => 'id',
                'on_del'  => 'RESTRICT',
            ),
            array(
                'table'   => self::table( 'sites' ),
                'name'    => 'fk_gilba_data_sites_precinct_group',
                'column'  => 'precinct_group_id',
                'ref'     => self::table( 'precinct_groups' ),
                'ref_col' => 'id',
                'on_del'  => 'SET NULL',
            ),
            array(
                'table'   => self::table( 'samples' ),
                'name'    => 'fk_gilba_data_samples_account',
                'column'  => 'account_id',
                'ref'     => self::table( 'accounts' ),
                'ref_col' => 'id',
                'on_del'  => 'RESTRICT',
            ),
            array(
                'table'   => self::table( 'samples' ),
                'name'    => 'fk_gilba_data_samples_site',
                'column'  => 'site_id',
                'ref'     => self::table( 'sites' ),
                'ref_col' => 'id',
                'on_del'  => 'RESTRICT',
            ),
            array(
                'table'   => self::table( 'spray_log' ),
                'name'    => 'fk_gilba_data_spray_log_account',
                'column'  => 'account_id',
                'ref'     => self::table( 'accounts' ),
                'ref_col' => 'id',
                'on_del'  => 'RESTRICT',
            ),
            array(
                'table'   => self::table( 'spray_log' ),
                'name'    => 'fk_gilba_data_spray_log_site',
                'column'  => 'site_id',
                'ref'     => self::table( 'sites' ),
                'ref_col' => 'id',
                'on_del'  => 'RESTRICT',
            ),
            array(
                'table'   => self::table( 'site_summaries' ),
                'name'    => 'fk_gilba_data_site_summaries_account',
                'column'  => 'account_id',
                'ref'     => self::table( 'accounts' ),
                'ref_col' => 'id',
                'on_del'  => 'CASCADE',
            ),
            array(
                'table'   => self::table( 'site_summaries' ),
                'name'    => 'fk_gilba_data_site_summaries_site',
                'column'  => 'site_id',
                'ref'     => self::table( 'sites' ),
                'ref_col' => 'id',
                'on_del'  => 'CASCADE',
            ),
        );

        $db_name = DB_NAME;

        foreach ( $constraints as $fk ) {
            // Check if the constraint already exists.
            // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $exists = $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
                 WHERE CONSTRAINT_SCHEMA = %s
                   AND TABLE_NAME = %s
                   AND CONSTRAINT_NAME = %s
                   AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
                $db_name,
                $fk['table'],
                $fk['name']
            ) );
            // phpcs:enable

            if ( $exists ) {
                continue;
            }

            $sql = sprintf(
                'ALTER TABLE `%s` ADD CONSTRAINT `%s` FOREIGN KEY (`%s`) REFERENCES `%s` (`%s`) ON DELETE %s ON UPDATE CASCADE',
                esc_sql( $fk['table'] ),
                esc_sql( $fk['name'] ),
                esc_sql( $fk['column'] ),
                esc_sql( $fk['ref'] ),
                esc_sql( $fk['ref_col'] ),
                esc_sql( $fk['on_del'] )
            );

            // Suppress errors so failures (e.g. orphan rows during an upgrade)
            // don't break activation. We log via error_log for ops.
            $wpdb->suppress_errors( true );
            $result = $wpdb->query( $sql ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
            $wpdb->suppress_errors( false );

            if ( false === $result && ! empty( $wpdb->last_error ) ) {
                error_log( sprintf(
                    '[gilba-data] FK add failed for %s.%s → %s.%s: %s',
                    $fk['table'],
                    $fk['column'],
                    $fk['ref'],
                    $fk['ref_col'],
                    $wpdb->last_error
                ) );
            }
        }
    }

    /**
     * Called by plugins_loaded to run migrations if schema version moved.
     */
    public static function maybe_upgrade() {
        $installed = get_option( self::OPTION_SCHEMA_VERSION, '' );
        if ( $installed !== GILBA_DATA_SCHEMA_VERSION ) {
            self::activate();
        }
    }
}
