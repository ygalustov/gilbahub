<?php
/**
 * Gilba Data Layer — Samples model
 *
 * Unified sample store for soil / water / tissue / loi. The methodology and
 * soil_texture snapshots are captured at write time so that historical
 * interpretation stays stable when the account defaults change.
 *
 * sample_type values: 'soil' | 'water' | 'tissue' | 'loi'
 *
 * @package Gilba_Hub
 * @since   b35fix301b
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gilba_Data_Samples extends Gilba_Data_Model {

    const TYPES = array( 'soil', 'water', 'tissue', 'loi' );

    protected static function table_key() {
        return 'samples';
    }

    protected static function hydrate( array $row ) {
        if ( isset( $row['payload_json'] ) ) {
            $row['payload'] = self::decode_json( $row['payload_json'] );
        }
        return $row;
    }

    /**
     * Insert a sample. Automatically snapshots methodology and soil_texture
     * from the site's resolved values unless explicitly provided.
     */
    public static function create( array $fields ) {
        global $wpdb;
        $table = self::table_name();

        if ( empty( $fields['account_id'] ) || empty( $fields['site_id'] ) || empty( $fields['sample_type'] ) ) {
            return null;
        }
        if ( ! in_array( $fields['sample_type'], self::TYPES, true ) ) {
            return null;
        }
        if ( ! array_key_exists( 'payload', $fields ) ) {
            return null;
        }

        // Snapshot methodology / soil_texture if not supplied.
        $methodology_snapshot = isset( $fields['methodology_snapshot'] ) && $fields['methodology_snapshot'] !== ''
            ? (string) $fields['methodology_snapshot']
            : (string) ( Gilba_Data_Sites::resolve_methodology( $fields['site_id'] ) ?: '' );

        $soil_texture_snapshot = isset( $fields['soil_texture_snapshot'] ) && $fields['soil_texture_snapshot'] !== ''
            ? (string) $fields['soil_texture_snapshot']
            : (string) ( Gilba_Data_Sites::resolve_soil_texture( $fields['site_id'] ) ?: '' );

        $data = array(
            'account_id'            => (int) $fields['account_id'],
            'site_id'               => (string) $fields['site_id'],
            'sample_type'           => (string) $fields['sample_type'],
            'lab_name'              => isset( $fields['lab_name'] ) ? (string) $fields['lab_name'] : '',
            'lab_ref'               => isset( $fields['lab_ref'] ) ? (string) $fields['lab_ref'] : '',
            'sample_date'           => isset( $fields['sample_date'] ) && $fields['sample_date'] !== '' ? (string) $fields['sample_date'] : null,
            'lab_date'              => isset( $fields['lab_date'] ) && $fields['lab_date'] !== '' ? (string) $fields['lab_date'] : null,
            'depth_mm'              => isset( $fields['depth_mm'] ) && $fields['depth_mm'] !== '' ? (int) $fields['depth_mm'] : null,
            'methodology_snapshot'  => $methodology_snapshot,
            'soil_texture_snapshot' => $soil_texture_snapshot,
            'payload_json'          => self::encode_json( $fields['payload'] ),
            'notes'                 => isset( $fields['notes'] ) ? (string) $fields['notes'] : null,
        );
        self::stamp_insert( $data );

        $inserted = $wpdb->insert( $table, $data );
        if ( ! $inserted ) {
            return null;
        }
        return self::get( $wpdb->insert_id );
    }

    /**
     * Update mutable fields. Snapshots are immutable by design — do not
     * allow them to be rewritten once captured.
     */
    public static function update( $id, array $fields ) {
        global $wpdb;
        $table = self::table_name();

        $allowed = array(
            'lab_name',
            'lab_ref',
            'sample_date',
            'lab_date',
            'depth_mm',
            'notes',
        );
        $data = array();
        foreach ( $allowed as $key ) {
            if ( array_key_exists( $key, $fields ) ) {
                $data[ $key ] = $fields[ $key ] === '' ? null : $fields[ $key ];
            }
        }
        if ( array_key_exists( 'payload', $fields ) ) {
            $data['payload_json'] = self::encode_json( $fields['payload'] );
        }
        if ( empty( $data ) ) {
            return false;
        }
        self::stamp_update( $data );

        $result = $wpdb->update( $table, $data, array( 'id' => $id ) );
        return false !== $result;
    }

    /**
     * List samples for a site, newest first by lab_date.
     */
    public static function list_for_site( $site_id, $sample_type = null, $limit = 50 ) {
        global $wpdb;
        $table = self::table_name();
        $limit = max( 1, min( 500, (int) $limit ) );

        $where  = array( 'site_id = %s', 'deleted_at IS NULL' );
        $params = array( $site_id );
        if ( $sample_type ) {
            $where[]  = 'sample_type = %s';
            $params[] = $sample_type;
        }

        $sql = 'SELECT * FROM ' . $table . ' WHERE ' . implode( ' AND ', $where )
             . ' ORDER BY lab_date DESC, id DESC LIMIT ' . $limit;

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );
        return array_map( array( __CLASS__, 'hydrate' ), $rows ?: array() );
    }

    public static function list_for_account( $account_id, $sample_type = null, $limit = 100 ) {
        global $wpdb;
        $table      = self::table_name();
        $account_id = (int) $account_id;
        $limit      = max( 1, min( 1000, (int) $limit ) );

        $where  = array( 'account_id = %d', 'deleted_at IS NULL' );
        $params = array( $account_id );
        if ( $sample_type ) {
            $where[]  = 'sample_type = %s';
            $params[] = $sample_type;
        }

        $sql = 'SELECT * FROM ' . $table . ' WHERE ' . implode( ' AND ', $where )
             . ' ORDER BY lab_date DESC, id DESC LIMIT ' . $limit;

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );
        return array_map( array( __CLASS__, 'hydrate' ), $rows ?: array() );
    }
}
