<?php
/**
 * Gilba Data Layer — Sites model
 *
 * A site is a precinct, venue, or pitch. Primary key is a UUIDv4 (CHAR(36))
 * so external IDs are stable across environments (Option X).
 *
 * methodology_override NULL means "inherit from account".
 * Use Gilba_Data_Sites::resolve_methodology( $site_id ) for the effective value.
 *
 * @package Gilba_Hub
 * @since   b35fix301b
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gilba_Data_Sites extends Gilba_Data_Model {

    protected static function table_key() {
        return 'sites';
    }

    protected static function hydrate( array $row ) {
        if ( isset( $row['attributes_json'] ) ) {
            $row['attributes'] = self::decode_json( $row['attributes_json'] );
        }
        return $row;
    }

    public static function create( array $fields ) {
        global $wpdb;
        $table = self::table_name();

        if ( empty( $fields['account_id'] ) || empty( $fields['name'] ) ) {
            return null;
        }

        $id = isset( $fields['id'] ) && is_string( $fields['id'] ) && strlen( $fields['id'] ) === 36
            ? $fields['id']
            : wp_generate_uuid4();

        $data = array(
            'id'                    => $id,
            'account_id'            => (int) $fields['account_id'],
            'precinct_group_id'     => isset( $fields['precinct_group_id'] ) && $fields['precinct_group_id'] !== '' ? (int) $fields['precinct_group_id'] : null,
            'parent_site_id'        => isset( $fields['parent_site_id'] ) && $fields['parent_site_id'] !== '' ? (string) $fields['parent_site_id'] : null,
            'name'                  => (string) $fields['name'],
            'site_type'             => isset( $fields['site_type'] ) ? (string) $fields['site_type'] : 'precinct',
            'latitude'              => isset( $fields['latitude'] ) && $fields['latitude'] !== '' ? (float) $fields['latitude'] : null,
            'longitude'             => isset( $fields['longitude'] ) && $fields['longitude'] !== '' ? (float) $fields['longitude'] : null,
            'methodology_override'  => isset( $fields['methodology_override'] ) && $fields['methodology_override'] !== '' ? (string) $fields['methodology_override'] : null,
            'soil_texture_override' => isset( $fields['soil_texture_override'] ) && $fields['soil_texture_override'] !== '' ? (string) $fields['soil_texture_override'] : null,
            'attributes_json'       => array_key_exists( 'attributes', $fields ) ? self::encode_json( $fields['attributes'] ) : null,
        );
        self::stamp_insert( $data );

        $inserted = $wpdb->insert( $table, $data );
        if ( ! $inserted ) {
            return null;
        }
        return self::get( $id );
    }

    public static function update( $id, array $fields ) {
        global $wpdb;
        $table = self::table_name();

        $allowed = array(
            'precinct_group_id',
            'parent_site_id',
            'name',
            'site_type',
            'latitude',
            'longitude',
            'methodology_override',
            'soil_texture_override',
        );
        $data = array();
        foreach ( $allowed as $key ) {
            if ( array_key_exists( $key, $fields ) ) {
                $data[ $key ] = $fields[ $key ] === '' ? null : $fields[ $key ];
            }
        }
        if ( array_key_exists( 'attributes', $fields ) ) {
            $data['attributes_json'] = self::encode_json( $fields['attributes'] );
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
        $sql .= ' ORDER BY name ASC';

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results( $wpdb->prepare( $sql, $account_id ), ARRAY_A );
        return array_map( array( __CLASS__, 'hydrate' ), $rows ?: array() );
    }

    public static function list_for_precinct_group( $group_id, $include_deleted = false ) {
        global $wpdb;
        $table    = self::table_name();
        $group_id = (int) $group_id;

        $sql = "SELECT * FROM {$table} WHERE precinct_group_id = %d";
        if ( ! $include_deleted ) {
            $sql .= ' AND deleted_at IS NULL';
        }
        $sql .= ' ORDER BY name ASC';

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results( $wpdb->prepare( $sql, $group_id ), ARRAY_A );
        return array_map( array( __CLASS__, 'hydrate' ), $rows ?: array() );
    }

    /**
     * List child sites (pitches) under a parent precinct site.
     */
    public static function list_children( $parent_site_id, $include_deleted = false ) {
        global $wpdb;
        $table = self::table_name();

        $sql = "SELECT * FROM {$table} WHERE parent_site_id = %s";
        if ( ! $include_deleted ) {
            $sql .= ' AND deleted_at IS NULL';
        }
        $sql .= ' ORDER BY name ASC';

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results( $wpdb->prepare( $sql, $parent_site_id ), ARRAY_A );
        return array_map( array( __CLASS__, 'hydrate' ), $rows ?: array() );
    }

    /**
     * Resolve the effective methodology for a site:
     *   site.methodology_override ?? account.methodology
     *
     * Returns null if the site can't be found.
     */
    public static function resolve_methodology( $site_id ) {
        $site = self::get( $site_id );
        if ( ! $site ) {
            return null;
        }
        if ( ! empty( $site['methodology_override'] ) ) {
            return $site['methodology_override'];
        }
        $account = Gilba_Data_Accounts::get( (int) $site['account_id'] );
        return $account ? $account['methodology'] : null;
    }

    /**
     * Resolve the effective soil texture for a site using the same pattern.
     */
    public static function resolve_soil_texture( $site_id ) {
        $site = self::get( $site_id );
        if ( ! $site ) {
            return null;
        }
        if ( ! empty( $site['soil_texture_override'] ) ) {
            return $site['soil_texture_override'];
        }
        $account = Gilba_Data_Accounts::get( (int) $site['account_id'] );
        return $account ? $account['soil_texture'] : null;
    }
}
