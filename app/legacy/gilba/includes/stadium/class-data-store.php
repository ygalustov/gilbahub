<?php
/**
 * Data Store
 * 
 * Simple database wrapper.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Data_Store {
    
    /**
     * Insert record
     */
    public function insert( $table, $data ) {
        global $wpdb;
        $wpdb->insert( $wpdb->prefix . $table, $data );
        return $wpdb->insert_id;
    }
    
    /**
     * Update record
     */
    public function update( $table, $id, $data ) {
        global $wpdb;
        return $wpdb->update( 
            $wpdb->prefix . $table, 
            $data, 
            [ 'id' => $id ] 
        );
    }
    
    /**
     * Update where
     */
    public function update_where( $table, $data, $where ) {
        global $wpdb;
        return $wpdb->update( $wpdb->prefix . $table, $data, $where );
    }
    
    /**
     * Get record
     */
    public function get( $table, $id ) {
        global $wpdb;
        return $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}{$table} WHERE id = %d",
            $id
        ), ARRAY_A );
    }
    
    /**
     * Query records
     */
    public function query( $table, $args = [] ) {
        global $wpdb;
        
        $sql = "SELECT * FROM {$wpdb->prefix}{$table} WHERE 1=1";
        $params = [];
        
        foreach ( $args as $key => $value ) {
            if ( in_array( $key, [ 'limit', 'offset', 'date_from', 'date_to' ] ) ) {
                continue;
            }
            $sql .= " AND {$key} = %s";
            $params[] = $value;
        }
        
        if ( isset( $args['date_from'] ) ) {
            $sql .= " AND date >= %s";
            $params[] = $args['date_from'];
        }
        
        if ( isset( $args['date_to'] ) ) {
            $sql .= " AND date <= %s";
            $params[] = $args['date_to'];
        }
        
        $sql .= " ORDER BY id DESC";
        
        if ( isset( $args['limit'] ) ) {
            $sql .= " LIMIT %d";
            $params[] = $args['limit'];
        }
        
        if ( ! empty( $params ) ) {
            $sql = $wpdb->prepare( $sql, $params );
        }
        
        return $wpdb->get_results( $sql, ARRAY_A );
    }
    
    /**
     * Delete record
     */
    public function delete( $table, $id ) {
        global $wpdb;
        return $wpdb->delete( $wpdb->prefix . $table, [ 'id' => $id ] );
    }
}
