<?php
/**
 * Plugin Name: Dope Sticky Header for Elementor Containers
 * Description: Adds smooth direction-aware sticky header controls to Elementor containers without forcing announcement bars to be sticky.
 * Version: 1.0.2
 * Author: Aminul Islam
 * Text Domain: dope-sticky-header
 * Requires Plugins: elementor
 *
 * @package DopeStickyHeader
 *
 * Elementor tested up to: 3.29.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'DOPE_STICKY_HEADER_VERSION', '1.0.2' );
define( 'DOPE_STICKY_HEADER_FILE', __FILE__ );
define( 'DOPE_STICKY_HEADER_PATH', __DIR__ );
define( 'DOPE_STICKY_HEADER_URL', plugin_dir_url( __FILE__ ) );

require_once DOPE_STICKY_HEADER_PATH . '/includes/class-dope-sticky-header-plugin.php';

Dope_Sticky_Header_Plugin::instance();
