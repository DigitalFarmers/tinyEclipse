<?php
/**
 * TinyEclipse Analytics Uninstall
 * Cleans up analytics-specific data.
 */
if (!defined('WP_UNINSTALL_PLUGIN')) exit;

// TinyEclipse Analytics — Uninstall

global $wpdb;
$wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}tinyeclipse_analytics");

delete_option('tinyeclipse_analytics_retention');

wp_clear_scheduled_hook('tinyeclipse_analytics_cleanup');
