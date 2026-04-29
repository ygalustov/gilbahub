<?php
/**
 * Gilba Data Layer — Base model
 *
 * Shared helpers for audit columns, soft delete, and JSON encode/decode.
 * Each table-specific model extends this.
 *
 * @package Gilba_Hub
 * @since   b35fix301b
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

abstract class Gilba_Data_Model {

    /**
     * Subclasses must return the table key ('accounts', 'sites', ...) used by
     * Gilba_Data_Schema::table().
     */
    abstract protected static function table_key();

    protected static function table_name() {
        return Gilba_Data_Schema::table( static::table_key() );
    }

    /**
     * Current GMT datetime string for audit columns.
     */
    protected static function now_gmt() {
        return current_time( 'mysql', 1 );
    }

    protected static function current_user_id() {
        $user_id = get_current_user_id();
        return $user_id ? (int) $user_id : 0;
    }

    /**
     * Wrap json_encode with safe defaults. NULL input → NULL (stored as NULL).
     * Empty array/object → '[]'/'{}' preserved.
     */
    protected static function encode_json( $value ) {
        if ( null === $value ) {
            return null;
        }
        return wp_json_encode( $value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
    }

    /**
     * Wrap json_decode; returns array, null on failure, or passes through if
     * the stored value is already NULL.
     */
    protected static function decode_json( $value ) {
        if ( null === $value || '' === $value ) {
            return null;
        }
        $decoded = json_decode( $value, true );
        return ( JSON_ERROR_NONE === json_last_error() ) ? $decoded : null;
    }

    /**
     * Fetch a single row by primary key, respecting soft delete by default.
     *
     * @param int|string $id
     * @param bool       $include_deleted
     * @return array|null
     */
    public static function get( $id, $include_deleted = false ) {
        global $wpdb;
        $table = static::table_name();

        $sql = "SELECT * FROM {$table} WHERE id = %s";
        if ( ! $include_deleted ) {
            $sql .= ' AND deleted_at IS NULL';
        }
        $sql .= ' LIMIT 1';

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $row = $wpdb->get_row( $wpdb->prepare( $sql, $id ), ARRAY_A );
        if ( ! $row ) {
            return null;
        }
        return static::hydrate( $row );
    }

    /**
     * Soft delete: set deleted_at and modified metadata.
     */
    public static function soft_delete( $id ) {
        global $wpdb;
        $table = static::table_name();
        $now   = self::now_gmt();

        $data = array(
            'deleted_at'          => $now,
            'updated_at'          => $now,
            'modified_by_user_id' => self::current_user_id(),
        );
        $where = array( 'id' => $id );

        $result = $wpdb->update( $table, $data, $where );
        return false !== $result;
    }

    /**
     * Restore a soft-deleted row.
     */
    public static function restore( $id ) {
        global $wpdb;
        $table = static::table_name();
        $now   = self::now_gmt();

        $data = array(
            'deleted_at'          => null,
            'updated_at'          => $now,
            'modified_by_user_id' => self::current_user_id(),
        );
        $where = array( 'id' => $id );

        $result = $wpdb->update( $table, $data, $where );
        return false !== $result;
    }

    /**
     * Default hydration — decode any JSON columns declared by subclass.
     * Subclasses may override for richer casting.
     */
    protected static function hydrate( array $row ) {
        return $row;
    }

    /**
     * Stamp audit columns on insert.
     */
    protected static function stamp_insert( array &$data ) {
        $now     = self::now_gmt();
        $user_id = self::current_user_id();
        if ( ! isset( $data['created_at'] ) ) {
            $data['created_at'] = $now;
        }
        if ( ! isset( $data['updated_at'] ) ) {
            $data['updated_at'] = $now;
        }
        if ( ! isset( $data['created_by_user_id'] ) ) {
            $data['created_by_user_id'] = $user_id;
        }
        if ( ! isset( $data['modified_by_user_id'] ) ) {
            $data['modified_by_user_id'] = $user_id;
        }
    }

    /**
     * Stamp audit columns on update.
     */
    protected static function stamp_update( array &$data ) {
        $data['updated_at']          = self::now_gmt();
        $data['modified_by_user_id'] = self::current_user_id();
    }
}
