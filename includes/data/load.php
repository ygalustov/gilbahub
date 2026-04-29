<?php
/**
 * Gilba Data Layer — Loader (b35fix301b)
 *
 * Single entry point that pulls in the six models, the REST controller,
 * and the schema bootstrap. Kept deliberately small so it can be swapped
 * to a sibling plugin's main file later.
 *
 * @package Gilba_Hub
 * @since   b35fix301b
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-gilba-data-schema.php';
require_once __DIR__ . '/class-gilba-data-model.php';
require_once __DIR__ . '/class-gilba-data-accounts.php';
require_once __DIR__ . '/class-gilba-data-precinct-groups.php';
require_once __DIR__ . '/class-gilba-data-sites.php';
require_once __DIR__ . '/class-gilba-data-samples.php';
require_once __DIR__ . '/class-gilba-data-spray-log.php';
require_once __DIR__ . '/class-gilba-data-site-summaries.php';
require_once __DIR__ . '/class-gilba-data-rest.php';

// REST routes (fired on rest_api_init)
Gilba_Data_REST::init();

// Upgrade check on every load — cheap, only acts if version changed.
add_action( 'plugins_loaded', array( 'Gilba_Data_Schema', 'maybe_upgrade' ), 5 );
