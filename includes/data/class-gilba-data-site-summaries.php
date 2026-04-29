<?php
/**
 * Gilba Data Layer — Site summaries model
 *
 * Ring buffer of derived summary snapshots for trend reporting. Keeps the
 * most recent N entries per (site_id, sample_type), dedup'd by lab_date.
 * A unique index on (site_id, sample_type, lab_date) catches race conditions
 * if two writes land at the same date.
 *
 * @package Gilba_Hub
 * @since   b35fix301b
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gilba_Data_Site_Summaries extends Gilba_Data_Model {

    /**
     * Default ring buffer depth. Jerry's spec: N=12 (typically 3 years of
     * quarterly samples, or one year of monthly).
     */
    const RING_BUFFER_N = 12;

    protected static function table_key() {
        return 'site_summaries';
    }

    protected static function hydrate( array $row ) {
        if ( isset( $row['summary_json'] ) ) {
            $row['summary'] = self::decode_json( $row['summary_json'] );
        }
        return $row;
    }

    /**
     * Upsert a summary row and then trim the ring buffer for that
     * (site_id, sample_type) pair back down to RING_BUFFER_N entries.
     *
     * Dedup: if an entry already exists for (site_id, sample_type, lab_date)
     * we UPDATE it rather than insert a duplicate.
     */
    public static function upsert( array $fields ) {
        global $wpdb;
        $table = self::table_name();

        foreach ( array( 'account_id', 'site_id', 'sample_type', 'lab_date' ) as $required ) {
            if ( empty( $fields[ $required ] ) ) {
                return null;
            }
        }
        if ( ! array_key_exists( 'summary', $fields ) ) {
            return null;
        }

        $methodology_snapshot = isset( $fields['methodology_snapshot'] ) && $fields['methodology_snapshot'] !== ''
            ? (string) $fields['methodology_snapshot']
            : (string) ( Gilba_Data_Sites::resolve_methodology( $fields['site_id'] ) ?: '' );

        $existing = self::find_by_unique( $fields['site_id'], $fields['sample_type'], $fields['lab_date'] );

        if ( $existing ) {
            $data = array(
                'summary_json'         => self::encode_json( $fields['summary'] ),
                'methodology_snapshot' => $methodology_snapshot,
                'source_sample_id'     => isset( $fields['source_sample_id'] ) && $fields['source_sample_id'] !== '' ? (int) $fields['source_sample_id'] : null,
            );
            self::stamp_update( $data );
            $wpdb->update( $table, $data, array( 'id' => $existing['id'] ) );
            $id = (int) $existing['id'];
        } else {
            $data = array(
                'account_id'           => (int) $fields['account_id'],
                'site_id'              => (string) $fields['site_id'],
                'sample_type'          => (string) $fields['sample_type'],
                'lab_date'             => (string) $fields['lab_date'],
                'methodology_snapshot' => $methodology_snapshot,
                'summary_json'         => self::encode_json( $fields['summary'] ),
                'source_sample_id'     => isset( $fields['source_sample_id'] ) && $fields['source_sample_id'] !== '' ? (int) $fields['source_sample_id'] : null,
            );
            self::stamp_insert( $data );
            $wpdb->insert( $table, $data );
            $id = (int) $wpdb->insert_id;
        }

        self::trim_ring_buffer( $fields['site_id'], $fields['sample_type'], self::RING_BUFFER_N );
        return $id ? self::get( $id ) : null;
    }

    /**
     * Find the existing summary for a unique (site, type, date) triple.
     */
    public static function find_by_unique( $site_id, $sample_type, $lab_date ) {
        global $wpdb;
        $table = self::table_name();

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$table}
              WHERE site_id = %s
                AND sample_type = %s
                AND lab_date = %s
              LIMIT 1",
            $site_id,
            $sample_type,
            $lab_date
        ), ARRAY_A );

        return $row ? self::hydrate( $row ) : null;
    }

    /**
     * Hard-delete old entries beyond N. We use DELETE rather than soft delete
     * for the ring buffer because these are derived rows — they can always
     * be recomputed from the samples table.
     */
    public static function trim_ring_buffer( $site_id, $sample_type, $keep = null ) {
        global $wpdb;
        $table = self::table_name();
        $keep  = null === $keep ? self::RING_BUFFER_N : max( 1, (int) $keep );

        // Find IDs to keep (the newest $keep by lab_date DESC)
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $keep_ids = $wpdb->get_col( $wpdb->prepare(
            "SELECT id FROM {$table}
              WHERE site_id = %s
                AND sample_type = %s
              ORDER BY lab_date DESC, id DESC
              LIMIT %d",
            $site_id,
            $sample_type,
            $keep
        ) );

        if ( empty( $keep_ids ) ) {
            return 0;
        }

        $placeholders = implode( ',', array_fill( 0, count( $keep_ids ), '%d' ) );
        $params       = array_merge( array( $site_id, $sample_type ), array_map( 'intval', $keep_ids ) );

        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $deleted = $wpdb->query( $wpdb->prepare(
            "DELETE FROM {$table}
              WHERE site_id = %s
                AND sample_type = %s
                AND id NOT IN ({$placeholders})",
            $params
        ) );
        // phpcs:enable

        return (int) $deleted;
    }

    public static function list_for_site( $site_id, $sample_type = null ) {
        global $wpdb;
        $table = self::table_name();

        $where  = array( 'site_id = %s', 'deleted_at IS NULL' );
        $params = array( $site_id );
        if ( $sample_type ) {
            $where[]  = 'sample_type = %s';
            $params[] = $sample_type;
        }

        $sql = 'SELECT * FROM ' . $table . ' WHERE ' . implode( ' AND ', $where )
             . ' ORDER BY lab_date DESC';

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );
        return array_map( array( __CLASS__, 'hydrate' ), $rows ?: array() );
    }
}
