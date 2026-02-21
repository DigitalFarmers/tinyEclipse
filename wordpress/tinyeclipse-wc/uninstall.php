<?php
/**
 * TinyEclipse WC Uninstall
 * Cleans up all WC-specific transients and options.
 */
if (!defined('WP_UNINSTALL_PLUGIN')) exit;

global $wpdb;

// Remove all abandoned cart transients
$wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_tinyeclipse_cart_%'");
$wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_timeout_tinyeclipse_cart_%'");
$wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_tinyeclipse_abandoned_sent_%'");
$wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_timeout_tinyeclipse_abandoned_sent_%'");

// Clear scheduled hooks
wp_clear_scheduled_hook('tinyeclipse_check_abandoned_carts');
