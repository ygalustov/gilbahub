<?php
/**
 * Gilba Data Layer — Spray log model
 *
 * Entries attach to a precinct (site_id). Option A pitch-scoping: the
 * applied_to_samples_json column holds the specific pitch sample IDs the
 * application was applied to, letting a single precinct-level entry fan
 * out to whichever pitches were sprayed that day.
 *
 * @package Gilba_Hub
 * @since   b35fix301b
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gilba_Data_Spray_Log extends Gilba_Data_Model {

    protected static function table_key() {
        return 'spray_log';
    }

    protected static function hydrate( array $row ) {
        if ( isset( $row['applied_to_site_ids_json'] ) ) {
            $row['applied_to_site_ids'] = self::decode_json( $row['applied_to_site_ids_json'] );
        }
        if ( isset( $row['applied_to_samples_json'] ) ) {
            $row['applied_to_samples'] = self::decode_json( $row['applied_to_samples_json'] );
        }
        if ( isset( $row['conditions_json'] ) ) {
            $row['conditions'] = self::decode_json( $row['conditions_json'] );
        }
        return $row;
    }

    public static function create( array $fields ) {
        global $wpdb;
        $table = self::table_name();

        if ( empty( $fields['account_id'] ) || empty( $fields['site_id'] ) || empty( $fields['event_date'] ) ) {
            return null;
        }

        $data = array(
            'account_id'               => (int) $fields['account_id'],
            'site_id'                  => (string) $fields['site_id'],
            'applied_to_site_ids_json' => array_key_exists( 'applied_to_site_ids', $fields ) ? self::encode_json( $fields['applied_to_site_ids'] ) : null,
            'applied_to_samples_json'  => array_key_exists( 'applied_to_samples', $fields ) ? self::encode_json( $fields['applied_to_samples'] ) : null,
            'event_date'               => (string) $fields['event_date'],
            'event_time'               => isset( $fields['event_time'] ) && $fields['event_time'] !== '' ? (string) $fields['event_time'] : null,
            'product_name'             => isset( $fields['product_name'] ) ? (string) $fields['product_name'] : '',
            'product_type'             => isset( $fields['product_type'] ) ? (string) $fields['product_type'] : '',
            'active_ingredient'        => isset( $fields['active_ingredient'] ) ? (string) $fields['active_ingredient'] : '',
            'rate_value'               => isset( $fields['rate_value'] ) && $fields['rate_value'] !== '' ? (float) $fields['rate_value'] : null,
            'rate_unit'                => isset( $fields['rate_unit'] ) ? (string) $fields['rate_unit'] : '',
            'area_treated_ha'          => isset( $fields['area_treated_ha'] ) && $fields['area_treated_ha'] !== '' ? (float) $fields['area_treated_ha'] : null,
            'water_rate_l_per_ha'      => isset( $fields['water_rate_l_per_ha'] ) && $fields['water_rate_l_per_ha'] !== '' ? (float) $fields['water_rate_l_per_ha'] : null,
            'operator'                 => isset( $fields['operator'] ) ? (string) $fields['operator'] : '',
            'conditions_json'          => array_key_exists( 'conditions', $fields ) ? self::encode_json( $fields['conditions'] ) : null,
            'notes'                    => isset( $fields['notes'] ) ? (string) $fields['notes'] : null,
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

        $scalar_allowed = array(
            'event_date',
            'event_time',
            'product_name',
            'product_type',
            'active_ingredient',
            'rate_value',
            'rate_unit',
            'area_treated_ha',
            'water_rate_l_per_ha',
            'operator',
            'notes',
        );
        $data = array();
        foreach ( $scalar_allowed as $key ) {
            if ( array_key_exists( $key, $fields ) ) {
                $data[ $key ] = $fields[ $key ] === '' ? null : $fields[ $key ];
            }
        }
        if ( array_key_exists( 'applied_to_site_ids', $fields ) ) {
            $data['applied_to_site_ids_json'] = self::encode_json( $fields['applied_to_site_ids'] );
        }
        if ( array_key_exists( 'applied_to_samples', $fields ) ) {
            $data['applied_to_samples_json'] = self::encode_json( $fields['applied_to_samples'] );
        }
        if ( array_key_exists( 'conditions', $fields ) ) {
            $data['conditions_json'] = self::encode_json( $fields['conditions'] );
        }
        if ( empty( $data ) ) {
            return false;
        }
        self::stamp_update( $data );

        $result = $wpdb->update( $table, $data, array( 'id' => $id ) );
        return false !== $result;
    }

    /**
     * List spray log entries for a precinct, newest first.
     */
    public static function list_for_site( $site_id, $limit = 50 ) {
        global $wpdb;
        $table = self::table_name();
        $limit = max( 1, min( 500, (int) $limit ) );

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $sql  = "SELECT * FROM {$table} WHERE site_id = %s AND deleted_at IS NULL ORDER BY event_date DESC, id DESC LIMIT {$limit}";
        $rows = $wpdb->get_results( $wpdb->prepare( $sql, $site_id ), ARRAY_A );
        return array_map( array( __CLASS__, 'hydrate' ), $rows ?: array() );
    }

    public static function list_for_account( $account_id, $limit = 200 ) {
        global $wpdb;
        $table      = self::table_name();
        $account_id = (int) $account_id;
        $limit      = max( 1, min( 2000, (int) $limit ) );

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $sql  = "SELECT * FROM {$table} WHERE account_id = %d AND deleted_at IS NULL ORDER BY event_date DESC, id DESC LIMIT {$limit}";
        $rows = $wpdb->get_results( $wpdb->prepare( $sql, $account_id ), ARRAY_A );
        return array_map( array( __CLASS__, 'hydrate' ), $rows ?: array() );
    }
}
