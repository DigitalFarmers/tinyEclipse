<?php
/**
 * Plugin Name: Eclipse Widget Loader
 * Description: Auto-loads the TinyEclipse AI widget. Drop in wp-content/mu-plugins/
 * Version: 2.0.0
 * Author: Digital Farmers
 */

if (!defined('ABSPATH')) exit;

define('ECLIPSE_API', 'https://api.tinyeclipse.digitalfarmers.be');

/**
 * Auto-onboard: fetch tenant config from Eclipse API based on domain.
 * Cached for 1 hour via WP transient.
 */
function eclipse_get_config() {
    $cache_key = 'eclipse_widget_config';
    $config = get_transient($cache_key);
    if ($config !== false) return $config;

    $domain = parse_url(home_url(), PHP_URL_HOST);
    $response = wp_remote_get(ECLIPSE_API . '/api/sites/onboard?domain=' . urlencode($domain), [
        'timeout' => 10,
        'sslverify' => true,
    ]);

    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
        return false;
    }

    $config = json_decode(wp_remote_retrieve_body($response), true);
    if (empty($config['tenant_id'])) return false;

    set_transient($cache_key, $config, HOUR_IN_SECONDS);
    return $config;
}

add_action('wp_footer', function() {
    if (is_admin()) return;

    $config = eclipse_get_config();
    if (!$config) return;

    $w = $config['widget'] ?? [];
    if (isset($w['enabled']) && !$w['enabled']) return;

    printf(
        '<script src="%s" data-tenant="%s" data-api="%s" data-color="%s" data-name="%s" data-lang="%s" data-position="%s" defer></script>',
        esc_url($config['widget_url'] ?? ECLIPSE_API . '/widget/v1/widget.js'),
        esc_attr($config['tenant_id']),
        esc_url($config['api_url'] ?? ECLIPSE_API),
        esc_attr($w['color'] ?? '#6C3CE1'),
        esc_attr($w['name'] ?? 'AI Assistant'),
        esc_attr($w['lang'] ?? 'nl'),
        esc_attr($w['position'] ?? 'bottom-right')
    );
});
