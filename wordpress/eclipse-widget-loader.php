<?php
/**
 * Plugin Name: Eclipse Widget Loader
 * Description: Loads the TinyEclipse AI widget on the frontend. Drop in wp-content/mu-plugins/
 * Version: 1.0.0
 * Author: Digital Farmers
 */

if (!defined('ABSPATH')) exit;

add_action('wp_footer', function() {
    // Don't load in admin or for logged-in admins editing
    if (is_admin()) return;
    
    // Configuration — update these for your site
    $config = [
        'api'      => 'https://api.tinyeclipse.digitalfarmers.be',
        'color'    => '#6C3CE1',
        'name'     => 'Chocotale AI',
        'lang'     => 'nl',
        'position' => 'bottom-right',
    ];
    
    // Auto-detect tenant ID from eclipse-ai plugin settings or use fallback
    $tenant_id = get_option('eclipse_ai_tenant_id', '');
    if (empty($tenant_id)) {
        // Fallback: detect from site URL
        $domain = parse_url(home_url(), PHP_URL_HOST);
        $tenant_map = [
            'staging.chocotale.online' => '5782713d-2bb6-4e27-8e33-682baff510ed',
            'chocotale.online'         => 'e71307b8-a263-4a0f-bdb5-64060fcd84d1',
            'tuchochocolate.com'       => '754a5b7c-4ac3-4093-a83b-3dbc673670ba',
        ];
        $tenant_id = $tenant_map[$domain] ?? '';
    }
    
    if (empty($tenant_id)) return;
    
    printf(
        '<script src="%s/widget/v1/widget.js" data-tenant="%s" data-api="%s" data-color="%s" data-name="%s" data-lang="%s" data-position="%s" defer></script>',
        esc_url($config['api']),
        esc_attr($tenant_id),
        esc_url($config['api']),
        esc_attr($config['color']),
        esc_attr($config['name']),
        esc_attr($config['lang']),
        esc_attr($config['position'])
    );
});
