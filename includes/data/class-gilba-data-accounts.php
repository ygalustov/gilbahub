<?php
/**
 * Gilba Data Layer — Accounts model
 *
 * One row per WP user (owner). Holds defaults that cascade to sites unless
 * a site overrides them.
 *
 * @package Gilba_Hub
 * @since   b35fix301b
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gilba_Data_Accounts extends Gilba_Data_Model {

    protected static function table_key() {
        return 'accounts';
    }

    protected static function hydrate( array $row ) {
        if ( isset( $row['settings_json'] ) ) {
            $row['settings'] = self::decode_json( $row['settings_json'] );
        }
        return $row;
    }

    /**
     * Get or create the account for a given WP user. Idempotent — safe on
     * every request. Returns the hydrated row.
     *
     * @param int $user_id
     * @return array|null
     */
    public static function get_or_create_for_user( $user_id ) {
        global $wpdb;
        $user_id = (int) $user_id;
        if ( $user_id <= 0 ) {
            return null;
        }

        $table = self::table_name();
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$table} WHERE owner_user_id = %d AND deleted_at IS NULL LIMIT 1",
            $user_id
        ), ARRAY_A );

        if ( $row ) {
            return self::hydrate( $row );
        }

        $user = get_user_by( 'id', $user_id );
        $data = array(
            'owner_user_id' => $user_id,
            'display_name'  => $user ? $user->display_name : '',
            'methodology'   => 'mlsn',
            'soil_texture'  => 'loam',
            'country'       => 'AU',
            'region'        => '',
            'settings_json' => null,
        );
        self::stamp_insert( $data );

        $inserted = $wpdb->insert( $table, $data );
        if ( ! $inserted ) {
            return null;
        }
        return self::get( $wpdb->insert_id );
    }

    /**
     * Update mutable fields.
     *
     * @param int   $id
     * @param array $fields Allowed: display_name, methodology, soil_texture,
     *                      country, region, settings (array, JSON-encoded).
     * @return bool
     */
    public static function update( $id, array $fields ) {
        global $wpdb;
        $table = self::table_name();

        $allowed = array( 'display_name', 'methodology', 'soil_texture', 'country', 'region' );
        $data    = array();
        foreach ( $allowed as $key ) {
            if ( array_key_exists( $key, $fields ) ) {
                $data[ $key ] = $fields[ $key ];
            }
        }
        if ( array_key_exists( 'settings', $fields ) ) {
            $data['settings_json'] = self::encode_json( $fields['settings'] );
        }

        if ( empty( $data ) ) {
            return false;
        }
        self::stamp_update( $data );

        $result = $wpdb->update( $table, $data, array( 'id' => $id ) );
        return false !== $result;
    }

    /**
     * List all non-deleted accounts. Typically there is one per user.
     */
    public static function list_all() {
        global $wpdb;
        $table = self::table_name();
        $rows  = $wpdb->get_results(
            "SELECT * FROM {$table} WHERE deleted_at IS NULL ORDER BY id ASC",
            ARRAY_A
        );
        return array_map( array( __CLASS__, 'hydrate' ), $rows ?: array() );
    }

    public static function create( array $fields ) {
        global $wpdb;
        $table = self::table_name();

        $data = array(
            'owner_user_id' => isset( $fields['owner_user_id'] ) ? (int) $fields['owner_user_id'] : self::current_user_id(),
            'display_name'  => isset( $fields['display_name'] ) ? (string) $fields['display_name'] : '',
            'methodology'   => isset( $fields['methodology'] ) ? (string) $fields['methodology'] : 'mlsn',
            'soil_texture'  => isset( $fields['soil_texture'] ) ? (string) $fields['soil_texture'] : 'loam',
            'country'       => isset( $fields['country'] ) ? (string) $fields['country'] : 'AU',
            'region'        => isset( $fields['region'] ) ? (string) $fields['region'] : '',
            'settings_json' => array_key_exists( 'settings', $fields ) ? self::encode_json( $fields['settings'] ) : null,
        );
        self::stamp_insert( $data );

        $inserted = $wpdb->insert( $table, $data );
        if ( ! $inserted ) {
            return null;
        }
        return self::get( $wpdb->insert_id );
    }
}
