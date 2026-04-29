<?php
/**
 * Gilba Data Layer — REST controller
 *
 * Exposes CRUD endpoints for the six foundation tables plus a methodology
 * resolver, under the namespace `gilba-data/v1`. Nothing in the current
 * JS calls these yet — they're in place for 301c's migration work.
 *
 * Permission model: every route requires `manage_options` for now. Proper
 * per-account auth arrives when the account/user linkage UI lands.
 *
 * Endpoints:
 *   GET    /accounts
 *   GET    /accounts/me
 *   GET    /accounts/{id}
 *   PUT    /accounts/{id}
 *
 *   GET    /precinct-groups?account_id=
 *   POST   /precinct-groups
 *   GET    /precinct-groups/{id}
 *   PUT    /precinct-groups/{id}
 *   DELETE /precinct-groups/{id}
 *
 *   GET    /sites?account_id= | ?precinct_group_id= | ?parent_site_id=
 *   POST   /sites
 *   GET    /sites/{id}
 *   PUT    /sites/{id}
 *   DELETE /sites/{id}
 *   GET    /sites/{id}/methodology
 *
 *   GET    /samples?site_id= | ?account_id= (&sample_type=&limit=)
 *   POST   /samples
 *   GET    /samples/{id}
 *   PUT    /samples/{id}
 *   DELETE /samples/{id}
 *
 *   GET    /spray-log?site_id= | ?account_id= (&limit=)
 *   POST   /spray-log
 *   GET    /spray-log/{id}
 *   PUT    /spray-log/{id}
 *   DELETE /spray-log/{id}
 *
 *   GET    /site-summaries?site_id= (&sample_type=)
 *   POST   /site-summaries           (upsert)
 *   GET    /site-summaries/{id}
 *
 * @package Gilba_Hub
 * @since   b35fix301b
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gilba_Data_REST {

    const REST_NS = 'gilba-data/v1';

    public static function init() {
        add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
    }

    public static function permission_check() {
        return current_user_can( 'manage_options' );
    }

    public static function register_routes() {
        $ns = self::REST_NS;

        // ---------- accounts ----------
        register_rest_route( $ns, '/accounts', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( __CLASS__, 'list_accounts' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( __CLASS__, 'create_account' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
        ) );
        register_rest_route( $ns, '/accounts/me', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array( __CLASS__, 'get_account_me' ),
            'permission_callback' => array( __CLASS__, 'permission_check' ),
        ) );
        register_rest_route( $ns, '/accounts/(?P<id>\d+)', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( __CLASS__, 'get_account' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
            array(
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => array( __CLASS__, 'update_account' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
        ) );

        // ---------- precinct groups ----------
        register_rest_route( $ns, '/precinct-groups', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( __CLASS__, 'list_precinct_groups' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( __CLASS__, 'create_precinct_group' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
        ) );
        register_rest_route( $ns, '/precinct-groups/(?P<id>\d+)', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( __CLASS__, 'get_precinct_group' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
            array(
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => array( __CLASS__, 'update_precinct_group' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
            array(
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => array( __CLASS__, 'delete_precinct_group' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
        ) );

        // ---------- sites ----------
        register_rest_route( $ns, '/sites', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( __CLASS__, 'list_sites' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( __CLASS__, 'create_site' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
        ) );
        register_rest_route( $ns, '/sites/(?P<id>[a-f0-9-]{36})', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( __CLASS__, 'get_site' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
            array(
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => array( __CLASS__, 'update_site' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
            array(
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => array( __CLASS__, 'delete_site' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
        ) );
        register_rest_route( $ns, '/sites/(?P<id>[a-f0-9-]{36})/methodology', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array( __CLASS__, 'resolve_site_methodology' ),
            'permission_callback' => array( __CLASS__, 'permission_check' ),
        ) );

        // ---------- samples ----------
        register_rest_route( $ns, '/samples', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( __CLASS__, 'list_samples' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( __CLASS__, 'create_sample' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
        ) );
        register_rest_route( $ns, '/samples/(?P<id>\d+)', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( __CLASS__, 'get_sample' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
            array(
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => array( __CLASS__, 'update_sample' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
            array(
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => array( __CLASS__, 'delete_sample' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
        ) );

        // ---------- spray log ----------
        register_rest_route( $ns, '/spray-log', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( __CLASS__, 'list_spray_log' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( __CLASS__, 'create_spray_log' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
        ) );
        register_rest_route( $ns, '/spray-log/(?P<id>\d+)', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( __CLASS__, 'get_spray_log' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
            array(
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => array( __CLASS__, 'update_spray_log' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
            array(
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => array( __CLASS__, 'delete_spray_log' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
        ) );

        // ---------- site summaries ----------
        register_rest_route( $ns, '/site-summaries', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( __CLASS__, 'list_site_summaries' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( __CLASS__, 'upsert_site_summary' ),
                'permission_callback' => array( __CLASS__, 'permission_check' ),
            ),
        ) );
        register_rest_route( $ns, '/site-summaries/(?P<id>\d+)', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array( __CLASS__, 'get_site_summary' ),
            'permission_callback' => array( __CLASS__, 'permission_check' ),
        ) );
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private static function not_found( $what = 'resource' ) {
        return new WP_Error(
            'gilba_data_not_found',
            sprintf( '%s not found', $what ),
            array( 'status' => 404 )
        );
    }

    private static function bad_request( $message = 'Bad request' ) {
        return new WP_Error( 'gilba_data_bad_request', $message, array( 'status' => 400 ) );
    }

    private static function server_error( $message = 'Server error' ) {
        return new WP_Error( 'gilba_data_server_error', $message, array( 'status' => 500 ) );
    }

    // ------------------------------------------------------------------
    // Accounts
    // ------------------------------------------------------------------

    public static function list_accounts( WP_REST_Request $request ) {
        return rest_ensure_response( Gilba_Data_Accounts::list_all() );
    }

    public static function get_account_me( WP_REST_Request $request ) {
        $account = Gilba_Data_Accounts::get_or_create_for_user( get_current_user_id() );
        if ( ! $account ) {
            return self::server_error( 'Could not resolve account' );
        }
        return rest_ensure_response( $account );
    }

    public static function get_account( WP_REST_Request $request ) {
        $account = Gilba_Data_Accounts::get( (int) $request['id'] );
        if ( ! $account ) {
            return self::not_found( 'Account' );
        }
        return rest_ensure_response( $account );
    }

    public static function create_account( WP_REST_Request $request ) {
        $created = Gilba_Data_Accounts::create( $request->get_json_params() ?: array() );
        if ( ! $created ) {
            return self::server_error( 'Could not create account' );
        }
        return rest_ensure_response( $created );
    }

    public static function update_account( WP_REST_Request $request ) {
        $id     = (int) $request['id'];
        $fields = $request->get_json_params() ?: array();
        if ( ! Gilba_Data_Accounts::update( $id, $fields ) ) {
            return self::bad_request( 'Nothing to update' );
        }
        return rest_ensure_response( Gilba_Data_Accounts::get( $id ) );
    }

    // ------------------------------------------------------------------
    // Precinct groups
    // ------------------------------------------------------------------

    public static function list_precinct_groups( WP_REST_Request $request ) {
        $account_id = (int) $request->get_param( 'account_id' );
        if ( $account_id <= 0 ) {
            return self::bad_request( 'account_id is required' );
        }
        return rest_ensure_response(
            Gilba_Data_Precinct_Groups::list_for_account( $account_id )
        );
    }

    public static function create_precinct_group( WP_REST_Request $request ) {
        $created = Gilba_Data_Precinct_Groups::create( $request->get_json_params() ?: array() );
        if ( ! $created ) {
            return self::bad_request( 'Could not create precinct group' );
        }
        return rest_ensure_response( $created );
    }

    public static function get_precinct_group( WP_REST_Request $request ) {
        $row = Gilba_Data_Precinct_Groups::get( (int) $request['id'] );
        if ( ! $row ) {
            return self::not_found( 'Precinct group' );
        }
        return rest_ensure_response( $row );
    }

    public static function update_precinct_group( WP_REST_Request $request ) {
        $id     = (int) $request['id'];
        $fields = $request->get_json_params() ?: array();
        if ( ! Gilba_Data_Precinct_Groups::update( $id, $fields ) ) {
            return self::bad_request( 'Nothing to update' );
        }
        return rest_ensure_response( Gilba_Data_Precinct_Groups::get( $id ) );
    }

    public static function delete_precinct_group( WP_REST_Request $request ) {
        $id = (int) $request['id'];
        if ( ! Gilba_Data_Precinct_Groups::soft_delete( $id ) ) {
            return self::server_error( 'Delete failed' );
        }
        return rest_ensure_response( array( 'deleted' => true, 'id' => $id ) );
    }

    // ------------------------------------------------------------------
    // Sites
    // ------------------------------------------------------------------

    public static function list_sites( WP_REST_Request $request ) {
        $account_id       = (int) $request->get_param( 'account_id' );
        $precinct_group_id = $request->get_param( 'precinct_group_id' );
        $parent_site_id   = $request->get_param( 'parent_site_id' );

        if ( $parent_site_id ) {
            return rest_ensure_response( Gilba_Data_Sites::list_children( $parent_site_id ) );
        }
        if ( null !== $precinct_group_id && '' !== $precinct_group_id ) {
            return rest_ensure_response( Gilba_Data_Sites::list_for_precinct_group( (int) $precinct_group_id ) );
        }
        if ( $account_id > 0 ) {
            return rest_ensure_response( Gilba_Data_Sites::list_for_account( $account_id ) );
        }
        return self::bad_request( 'Provide account_id, precinct_group_id, or parent_site_id' );
    }

    public static function create_site( WP_REST_Request $request ) {
        $created = Gilba_Data_Sites::create( $request->get_json_params() ?: array() );
        if ( ! $created ) {
            return self::bad_request( 'Could not create site' );
        }
        return rest_ensure_response( $created );
    }

    public static function get_site( WP_REST_Request $request ) {
        $row = Gilba_Data_Sites::get( (string) $request['id'] );
        if ( ! $row ) {
            return self::not_found( 'Site' );
        }
        return rest_ensure_response( $row );
    }

    public static function update_site( WP_REST_Request $request ) {
        $id     = (string) $request['id'];
        $fields = $request->get_json_params() ?: array();
        if ( ! Gilba_Data_Sites::update( $id, $fields ) ) {
            return self::bad_request( 'Nothing to update' );
        }
        return rest_ensure_response( Gilba_Data_Sites::get( $id ) );
    }

    public static function delete_site( WP_REST_Request $request ) {
        $id = (string) $request['id'];
        if ( ! Gilba_Data_Sites::soft_delete( $id ) ) {
            return self::server_error( 'Delete failed' );
        }
        return rest_ensure_response( array( 'deleted' => true, 'id' => $id ) );
    }

    public static function resolve_site_methodology( WP_REST_Request $request ) {
        $id           = (string) $request['id'];
        $methodology  = Gilba_Data_Sites::resolve_methodology( $id );
        $soil_texture = Gilba_Data_Sites::resolve_soil_texture( $id );
        if ( null === $methodology ) {
            return self::not_found( 'Site' );
        }
        return rest_ensure_response( array(
            'site_id'      => $id,
            'methodology'  => $methodology,
            'soil_texture' => $soil_texture,
        ) );
    }

    // ------------------------------------------------------------------
    // Samples
    // ------------------------------------------------------------------

    public static function list_samples( WP_REST_Request $request ) {
        $site_id     = $request->get_param( 'site_id' );
        $account_id  = (int) $request->get_param( 'account_id' );
        $sample_type = $request->get_param( 'sample_type' ) ?: null;
        $limit       = (int) ( $request->get_param( 'limit' ) ?: 100 );

        if ( $site_id ) {
            return rest_ensure_response(
                Gilba_Data_Samples::list_for_site( (string) $site_id, $sample_type, $limit )
            );
        }
        if ( $account_id > 0 ) {
            return rest_ensure_response(
                Gilba_Data_Samples::list_for_account( $account_id, $sample_type, $limit )
            );
        }
        return self::bad_request( 'Provide site_id or account_id' );
    }

    public static function create_sample( WP_REST_Request $request ) {
        $created = Gilba_Data_Samples::create( $request->get_json_params() ?: array() );
        if ( ! $created ) {
            return self::bad_request( 'Could not create sample (check account_id, site_id, sample_type, payload)' );
        }
        return rest_ensure_response( $created );
    }

    public static function get_sample( WP_REST_Request $request ) {
        $row = Gilba_Data_Samples::get( (int) $request['id'] );
        if ( ! $row ) {
            return self::not_found( 'Sample' );
        }
        return rest_ensure_response( $row );
    }

    public static function update_sample( WP_REST_Request $request ) {
        $id     = (int) $request['id'];
        $fields = $request->get_json_params() ?: array();
        if ( ! Gilba_Data_Samples::update( $id, $fields ) ) {
            return self::bad_request( 'Nothing to update' );
        }
        return rest_ensure_response( Gilba_Data_Samples::get( $id ) );
    }

    public static function delete_sample( WP_REST_Request $request ) {
        $id = (int) $request['id'];
        if ( ! Gilba_Data_Samples::soft_delete( $id ) ) {
            return self::server_error( 'Delete failed' );
        }
        return rest_ensure_response( array( 'deleted' => true, 'id' => $id ) );
    }

    // ------------------------------------------------------------------
    // Spray log
    // ------------------------------------------------------------------

    public static function list_spray_log( WP_REST_Request $request ) {
        $site_id    = $request->get_param( 'site_id' );
        $account_id = (int) $request->get_param( 'account_id' );
        $limit      = (int) ( $request->get_param( 'limit' ) ?: 200 );

        if ( $site_id ) {
            return rest_ensure_response(
                Gilba_Data_Spray_Log::list_for_site( (string) $site_id, $limit )
            );
        }
        if ( $account_id > 0 ) {
            return rest_ensure_response(
                Gilba_Data_Spray_Log::list_for_account( $account_id, $limit )
            );
        }
        return self::bad_request( 'Provide site_id or account_id' );
    }

    public static function create_spray_log( WP_REST_Request $request ) {
        $created = Gilba_Data_Spray_Log::create( $request->get_json_params() ?: array() );
        if ( ! $created ) {
            return self::bad_request( 'Could not create spray log entry' );
        }
        return rest_ensure_response( $created );
    }

    public static function get_spray_log( WP_REST_Request $request ) {
        $row = Gilba_Data_Spray_Log::get( (int) $request['id'] );
        if ( ! $row ) {
            return self::not_found( 'Spray log entry' );
        }
        return rest_ensure_response( $row );
    }

    public static function update_spray_log( WP_REST_Request $request ) {
        $id     = (int) $request['id'];
        $fields = $request->get_json_params() ?: array();
        if ( ! Gilba_Data_Spray_Log::update( $id, $fields ) ) {
            return self::bad_request( 'Nothing to update' );
        }
        return rest_ensure_response( Gilba_Data_Spray_Log::get( $id ) );
    }

    public static function delete_spray_log( WP_REST_Request $request ) {
        $id = (int) $request['id'];
        if ( ! Gilba_Data_Spray_Log::soft_delete( $id ) ) {
            return self::server_error( 'Delete failed' );
        }
        return rest_ensure_response( array( 'deleted' => true, 'id' => $id ) );
    }

    // ------------------------------------------------------------------
    // Site summaries
    // ------------------------------------------------------------------

    public static function list_site_summaries( WP_REST_Request $request ) {
        $site_id     = $request->get_param( 'site_id' );
        $sample_type = $request->get_param( 'sample_type' ) ?: null;
        if ( ! $site_id ) {
            return self::bad_request( 'site_id is required' );
        }
        return rest_ensure_response(
            Gilba_Data_Site_Summaries::list_for_site( (string) $site_id, $sample_type )
        );
    }

    public static function upsert_site_summary( WP_REST_Request $request ) {
        $row = Gilba_Data_Site_Summaries::upsert( $request->get_json_params() ?: array() );
        if ( ! $row ) {
            return self::bad_request( 'Could not upsert site summary' );
        }
        return rest_ensure_response( $row );
    }

    public static function get_site_summary( WP_REST_Request $request ) {
        $row = Gilba_Data_Site_Summaries::get( (int) $request['id'] );
        if ( ! $row ) {
            return self::not_found( 'Site summary' );
        }
        return rest_ensure_response( $row );
    }
}
