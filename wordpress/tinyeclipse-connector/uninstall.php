<?php
/**
 * TinyEclipse Connector — Uninstall
 * Removes all plugin options and DB tables when the plugin is deleted (not deactivated).
 */
if (!defined('WP_UNINSTALL_PLUGIN')) exit;

// Options
$options = [
    'tinyeclipse_tenant_id', 'tinyeclipse_site_id', 'tinyeclipse_hub_api_key', 'tinyeclipse_hub_url',
    'tinyeclipse_enabled', 'tinyeclipse_color', 'tinyeclipse_name', 'tinyeclipse_lang',
    'tinyeclipse_position', 'tinyeclipse_exclude_pages', 'tinyeclipse_exclude_roles',
    'tinyeclipse_modules', 'tinyeclipse_report_email', 'tinyeclipse_auto_report',
    'tinyeclipse_log_retention', 'tinyeclipse_last_sync',
    'tinyeclipse_translate_key', 'tinyeclipse_translate_provider', 'tinyeclipse_translate_model',
    'tinyeclipse_translate_progress',
];
foreach ($options as $opt) {
    delete_option($opt);
}

// DB tables
global $wpdb;
$tables = [
    'tinyeclipse_logs', 'tinyeclipse_reports', 'tinyeclipse_mail_log',
    'tinyeclipse_security', 'tinyeclipse_tokens', 'tinyeclipse_token_log',
];
foreach ($tables as $t) {
    $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}{$t}");
}

// Cron
wp_clear_scheduled_hook('tinyeclipse_hourly_scan');
wp_clear_scheduled_hook('tinyeclipse_daily_report');
wp_clear_scheduled_hook('tinyeclipse_command_poll');

// Transients
delete_transient('tinyeclipse_last_heartbeat');
