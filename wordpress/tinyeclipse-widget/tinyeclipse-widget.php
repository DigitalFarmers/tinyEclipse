<?php
/**
 * Plugin Name: TinyEclipse AI Widget
 * Plugin URI: https://tinyeclipse.nl
 * Description: Adds the TinyEclipse AI chat widget to your WordPress site. Configure your Tenant ID and API URL in Settings → TinyEclipse.
 * Version: 1.0.0
 * Author: Digital Farmers
 * License: Proprietary
 */

if (!defined('ABSPATH')) exit;

// ============================================================
// Settings Page
// ============================================================

add_action('admin_menu', function () {
    add_options_page(
        'TinyEclipse Settings',
        'TinyEclipse',
        'manage_options',
        'tinyeclipse',
        'tinyeclipse_settings_page'
    );
});

add_action('admin_init', function () {
    register_setting('tinyeclipse_settings', 'tinyeclipse_tenant_id', [
        'type' => 'string',
        'sanitize_callback' => 'sanitize_text_field',
        'default' => '',
    ]);
    register_setting('tinyeclipse_settings', 'tinyeclipse_api_url', [
        'type' => 'string',
        'sanitize_callback' => 'esc_url_raw',
        'default' => 'https://api.tinyeclipse.nl',
    ]);
    register_setting('tinyeclipse_settings', 'tinyeclipse_enabled', [
        'type' => 'boolean',
        'default' => true,
    ]);
    register_setting('tinyeclipse_settings', 'tinyeclipse_position', [
        'type' => 'string',
        'sanitize_callback' => 'sanitize_text_field',
        'default' => 'bottom-right',
    ]);
});

function tinyeclipse_settings_page() {
    $tenant_id = get_option('tinyeclipse_tenant_id', '');
    $api_url = get_option('tinyeclipse_api_url', 'https://api.tinyeclipse.nl');
    $enabled = get_option('tinyeclipse_enabled', true);
    $position = get_option('tinyeclipse_position', 'bottom-right');
    ?>
    <div class="wrap">
        <h1>TinyEclipse AI Widget</h1>
        <p>Configure your TinyEclipse AI chat widget. Get your Tenant ID from the <a href="<?php echo esc_url($api_url); ?>" target="_blank">TinyEclipse Admin Panel</a>.</p>

        <form method="post" action="options.php">
            <?php settings_fields('tinyeclipse_settings'); ?>

            <table class="form-table">
                <tr>
                    <th scope="row"><label for="tinyeclipse_enabled">Enable Widget</label></th>
                    <td>
                        <input type="checkbox" id="tinyeclipse_enabled" name="tinyeclipse_enabled" value="1" <?php checked($enabled); ?> />
                        <p class="description">Show the AI chat widget on your site.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="tinyeclipse_tenant_id">Tenant ID</label></th>
                    <td>
                        <input type="text" id="tinyeclipse_tenant_id" name="tinyeclipse_tenant_id"
                               value="<?php echo esc_attr($tenant_id); ?>"
                               class="regular-text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                        <p class="description">Your unique TinyEclipse Tenant ID (UUID).</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="tinyeclipse_api_url">API URL</label></th>
                    <td>
                        <input type="url" id="tinyeclipse_api_url" name="tinyeclipse_api_url"
                               value="<?php echo esc_attr($api_url); ?>"
                               class="regular-text" placeholder="https://api.tinyeclipse.nl" />
                        <p class="description">TinyEclipse backend API URL.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="tinyeclipse_position">Widget Position</label></th>
                    <td>
                        <select id="tinyeclipse_position" name="tinyeclipse_position">
                            <option value="bottom-right" <?php selected($position, 'bottom-right'); ?>>Bottom Right</option>
                            <option value="bottom-left" <?php selected($position, 'bottom-left'); ?>>Bottom Left</option>
                        </select>
                    </td>
                </tr>
            </table>

            <?php submit_button('Save Settings'); ?>
        </form>

        <?php if ($tenant_id): ?>
        <hr />
        <h2>Status</h2>
        <p style="color: green; font-weight: bold;">✅ Widget is <?php echo $enabled ? 'active' : 'disabled'; ?></p>
        <p><strong>Tenant:</strong> <code><?php echo esc_html($tenant_id); ?></code></p>
        <p><strong>API:</strong> <code><?php echo esc_html($api_url); ?></code></p>
        <?php endif; ?>
    </div>
    <?php
}

// ============================================================
// Inject Widget Script
// ============================================================

add_action('wp_footer', function () {
    $enabled = get_option('tinyeclipse_enabled', true);
    $tenant_id = get_option('tinyeclipse_tenant_id', '');
    $api_url = get_option('tinyeclipse_api_url', 'https://api.tinyeclipse.nl');
    $position = get_option('tinyeclipse_position', 'bottom-right');

    if (!$enabled || empty($tenant_id)) return;

    // Don't show in admin or for logged-in admins editing
    if (is_admin()) return;

    printf(
        '<script src="%s/widget/v1/widget.js" data-tenant="%s" data-api="%s" data-position="%s" async></script>',
        esc_url($api_url),
        esc_attr($tenant_id),
        esc_url($api_url),
        esc_attr($position)
    );
});

// ============================================================
// Admin Notice if not configured
// ============================================================

add_action('admin_notices', function () {
    $tenant_id = get_option('tinyeclipse_tenant_id', '');
    if (empty($tenant_id)) {
        echo '<div class="notice notice-warning"><p><strong>TinyEclipse:</strong> Widget not configured yet. <a href="' . admin_url('options-general.php?page=tinyeclipse') . '">Set your Tenant ID</a> to activate the AI assistant.</p></div>';
    }
});
