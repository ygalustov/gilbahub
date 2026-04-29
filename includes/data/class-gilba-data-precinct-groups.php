<?php
/**
 * Gilba Data Layer — Precinct groups model
 *
 * Controlled vocabulary for grouping sites within an account (e.g. a council
 * might use "West / Central / East").
 *
 * @package Gilba_Hub
 * @since   b35fix301b
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gilba_Data_Precinct_Groups extends Gilba_Data_Model {

    protected static function table_key() {
        return 'precinct_groups';
    }

    public static function create( array $fields ) {
        global $wpdb;
        $table = self::table_name();

        if ( empty( $fields['account_id'] ) || empty( $fields['name'] ) ) {
            return null;
        }

        $slug = isset( $fields['slug'] ) && $fields['slug'] !== ''
            ? sanitize_title( (string) $fields['slug'] )
            : sanitize_title( (string) $fields['name'] );

        $data = array(
            'account_id' => (int) $fields['account_id'],
            'name'       => (string) $fields['name'],
            'slug'       => $slug,
            'sort_order' => isset( $fields['sort_order'] ) ? (int) $fields['sort_order'] : 0,
        );
        self::stamp_insert( $data );

        $inserted = $wpdb->insert( $table, $data );
        if ( ! $inserted ) {
            return null;
        }
        return self::get( $wpdb->insert_id );
    }

    public static function update( $id, array $fields ) {
        global $wpdb;
        $table = self::table_name();

        $allowed = array( 'name', 'slug', 'sort_order' );
        $data    = array();
        foreach ( $allowed as $key ) {
            if ( array_key_exists( $key, $fields ) ) {
                $data[ $key ] = $fields[ $key ];
            }
        }
        if ( isset( $data['slug'] ) ) {
            $data['slug'] = sanitize_title( (string) $data['slug'] );
        }
        if ( empty( $data ) ) {
            return false;
        }
        self::stamp_update( $data );
        $result = $wpdb->update( $table, $data, array( 'id' => $id ) );
        return false !== $result;
    }

    public static function list_for_account( $account_id, $include_deleted = false ) {
        global $wpdb;
        $table      = self::table_name();
        $account_id = (int) $account_id;

        $sql = "SELECT * FROM {$table} WHERE account_id = %d";
        if ( ! $include_deleted ) {
            $sql .= ' AND deleted_at IS NULL';
        }
        $sql .= ' ORDER BY sort_order ASC, name ASC';

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results( $wpdb->prepare( $sql, $account_id ), ARRAY_A );
        return $rows ?: array();
    }
}
