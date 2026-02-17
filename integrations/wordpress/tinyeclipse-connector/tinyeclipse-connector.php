<?php
/**
 * Plugin Name: TinyEclipse Connector
 * Plugin URI: https://tinyeclipse.digitalfarmers.be
 * Description: Connect your WordPress site to TinyEclipse — AI Chat, Visitor Tracking, Proactive Help & 24/7 Monitoring by Digital Farmers.
 * Version: 1.0.0
 * Author: Digital Farmers
 * Author URI: https://digitalfarmers.be
 * License: GPL v2 or later
 * Text Domain: tinyeclipse
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) exit;

define('TINYECLIPSE_VERSION', '1.0.0');
define('TINYECLIPSE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('TINYECLIPSE_PLUGIN_URL', plugin_dir_url(__FILE__));
define('TINYECLIPSE_API_BASE', 'https://api.tinyeclipse.digitalfarmers.be');

// ─── Admin Menu ───
add_action('admin_menu', function () {
    add_menu_page(
        'TinyEclipse',
        'TinyEclipse',
        'manage_options',
        'tinyeclipse',
        'tinyeclipse_settings_page',
        'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>'),
        30
    );
});

// ─── Settings ───
add_action('admin_init', function () {
    register_setting('tinyeclipse_settings', 'tinyeclipse_tenant_id', [
        'type' => 'string',
        'sanitize_callback' => 'sanitize_text_field',
    ]);
    register_setting('tinyeclipse_settings', 'tinyeclipse_enabled', [
        'type' => 'boolean',
        'default' => false,
    ]);
    register_setting('tinyeclipse_settings', 'tinyeclipse_color', [
        'type' => 'string',
        'default' => '#6C3CE1',
        'sanitize_callback' => 'sanitize_hex_color',
    ]);
    register_setting('tinyeclipse_settings', 'tinyeclipse_name', [
        'type' => 'string',
        'default' => get_bloginfo('name') . ' AI',
        'sanitize_callback' => 'sanitize_text_field',
    ]);
    register_setting('tinyeclipse_settings', 'tinyeclipse_lang', [
        'type' => 'string',
        'default' => 'nl',
        'sanitize_callback' => 'sanitize_text_field',
    ]);
    register_setting('tinyeclipse_settings', 'tinyeclipse_position', [
        'type' => 'string',
        'default' => 'bottom-right',
        'sanitize_callback' => 'sanitize_text_field',
    ]);
    register_setting('tinyeclipse_settings', 'tinyeclipse_exclude_pages', [
        'type' => 'string',
        'default' => '',
        'sanitize_callback' => 'sanitize_textarea_field',
    ]);
    register_setting('tinyeclipse_settings', 'tinyeclipse_exclude_roles', [
        'type' => 'array',
        'default' => ['administrator'],
    ]);
});

// ─── Settings Page ───
function tinyeclipse_settings_page() {
    $tenant_id = get_option('tinyeclipse_tenant_id', '');
    $enabled = get_option('tinyeclipse_enabled', false);
    $color = get_option('tinyeclipse_color', '#6C3CE1');
    $name = get_option('tinyeclipse_name', get_bloginfo('name') . ' AI');
    $lang = get_option('tinyeclipse_lang', 'nl');
    $position = get_option('tinyeclipse_position', 'bottom-right');
    $exclude_pages = get_option('tinyeclipse_exclude_pages', '');
    $exclude_roles = get_option('tinyeclipse_exclude_roles', ['administrator']);
    $connection_status = tinyeclipse_check_connection($tenant_id);
    ?>
    <div class="wrap" style="max-width:800px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
            <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#9333ea);display:flex;align-items:center;justify-content:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <div>
                <h1 style="margin:0;font-size:22px;">TinyEclipse</h1>
                <p style="margin:0;color:#666;font-size:13px;">AI Chat & Intelligence by Digital Farmers</p>
            </div>
        </div>

        <?php if ($connection_status === 'connected'): ?>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:8px;">
                <span style="color:#16a34a;font-size:18px;">●</span>
                <span style="color:#166534;font-size:13px;font-weight:500;">Connected — TinyEclipse is actief op je site</span>
            </div>
        <?php elseif ($tenant_id && $connection_status !== 'connected'): ?>
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:8px;">
                <span style="color:#dc2626;font-size:18px;">●</span>
                <span style="color:#991b1b;font-size:13px;font-weight:500;">Verbinding mislukt — controleer je Tenant ID</span>
            </div>
        <?php endif; ?>

        <form method="post" action="options.php">
            <?php settings_fields('tinyeclipse_settings'); ?>

            <!-- Connection -->
            <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:16px;">
                <h2 style="margin:0 0 16px;font-size:16px;">🔌 Verbinding</h2>
                <table class="form-table" style="margin:0;">
                    <tr>
                        <th scope="row"><label for="tinyeclipse_tenant_id">Tenant ID</label></th>
                        <td>
                            <input type="text" id="tinyeclipse_tenant_id" name="tinyeclipse_tenant_id"
                                value="<?php echo esc_attr($tenant_id); ?>"
                                class="regular-text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                style="font-family:monospace;" />
                            <p class="description">Je vindt dit in het <a href="https://tinyeclipse.digitalfarmers.be" target="_blank">Eclipse HUB</a> dashboard.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Status</th>
                        <td>
                            <label>
                                <input type="checkbox" name="tinyeclipse_enabled" value="1" <?php checked($enabled); ?> />
                                Widget & tracking inschakelen
                            </label>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Appearance -->
            <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:16px;">
                <h2 style="margin:0 0 16px;font-size:16px;">🎨 Uiterlijk</h2>
                <table class="form-table" style="margin:0;">
                    <tr>
                        <th scope="row"><label for="tinyeclipse_name">Naam in chat</label></th>
                        <td>
                            <input type="text" id="tinyeclipse_name" name="tinyeclipse_name"
                                value="<?php echo esc_attr($name); ?>" class="regular-text"
                                placeholder="<?php echo esc_attr(get_bloginfo('name')); ?> AI" />
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="tinyeclipse_color">Themakleur</label></th>
                        <td>
                            <input type="color" id="tinyeclipse_color" name="tinyeclipse_color"
                                value="<?php echo esc_attr($color); ?>" style="width:60px;height:36px;padding:2px;cursor:pointer;" />
                            <input type="text" value="<?php echo esc_attr($color); ?>" style="width:100px;margin-left:8px;font-family:monospace;"
                                onchange="document.getElementById('tinyeclipse_color').value=this.value" />
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="tinyeclipse_lang">Taal</label></th>
                        <td>
                            <select id="tinyeclipse_lang" name="tinyeclipse_lang">
                                <option value="nl" <?php selected($lang, 'nl'); ?>>Nederlands</option>
                                <option value="en" <?php selected($lang, 'en'); ?>>English</option>
                                <option value="fr" <?php selected($lang, 'fr'); ?>>Français</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="tinyeclipse_position">Positie</label></th>
                        <td>
                            <select id="tinyeclipse_position" name="tinyeclipse_position">
                                <option value="bottom-right" <?php selected($position, 'bottom-right'); ?>>Rechtsonder</option>
                                <option value="bottom-left" <?php selected($position, 'bottom-left'); ?>>Linksonder</option>
                            </select>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Advanced -->
            <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:16px;">
                <h2 style="margin:0 0 16px;font-size:16px;">⚙️ Geavanceerd</h2>
                <table class="form-table" style="margin:0;">
                    <tr>
                        <th scope="row"><label for="tinyeclipse_exclude_pages">Uitsluiten op pagina's</label></th>
                        <td>
                            <textarea id="tinyeclipse_exclude_pages" name="tinyeclipse_exclude_pages"
                                rows="3" class="large-text" placeholder="/wp-admin&#10;/checkout&#10;/bedankt"
                            ><?php echo esc_textarea($exclude_pages); ?></textarea>
                            <p class="description">Eén pad per regel. Widget wordt niet getoond op deze pagina's.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Verbergen voor rollen</th>
                        <td>
                            <?php
                            $roles = wp_roles()->get_names();
                            foreach ($roles as $role_key => $role_name):
                            ?>
                                <label style="display:block;margin-bottom:4px;">
                                    <input type="checkbox" name="tinyeclipse_exclude_roles[]"
                                        value="<?php echo esc_attr($role_key); ?>"
                                        <?php checked(in_array($role_key, (array)$exclude_roles)); ?> />
                                    <?php echo esc_html($role_name); ?>
                                </label>
                            <?php endforeach; ?>
                            <p class="description">Widget wordt niet getoond voor deze gebruikersrollen.</p>
                        </td>
                    </tr>
                </table>
            </div>

            <?php submit_button('Opslaan', 'primary', 'submit', true, ['style' => 'padding:8px 24px;']); ?>
        </form>

        <!-- Embed Code -->
        <?php if ($tenant_id): ?>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-top:16px;">
            <h2 style="margin:0 0 16px;font-size:16px;">📋 Handmatige embed code</h2>
            <p style="color:#666;font-size:13px;margin-bottom:12px;">Gebruik deze code als je de widget op een andere (niet-WordPress) site wilt plaatsen:</p>
            <textarea readonly rows="5" class="large-text" style="font-family:monospace;font-size:12px;background:#f9fafb;border-color:#e5e7eb;">&lt;script src="<?php echo esc_url(TINYECLIPSE_API_BASE); ?>/widget/v1/widget.js"
  data-tenant="<?php echo esc_attr($tenant_id); ?>"
  data-api="<?php echo esc_url(TINYECLIPSE_API_BASE); ?>"
  data-color="<?php echo esc_attr($color); ?>"
  data-name="<?php echo esc_attr($name); ?>"
  data-lang="<?php echo esc_attr($lang); ?>"
  data-position="<?php echo esc_attr($position); ?>"
  async&gt;&lt;/script&gt;</textarea>
        </div>
        <?php endif; ?>

        <p style="text-align:center;margin-top:24px;color:#9ca3af;font-size:11px;">
            TinyEclipse v<?php echo TINYECLIPSE_VERSION; ?> — <a href="https://tinyeclipse.digitalfarmers.be" target="_blank" style="color:#6366f1;">Eclipse HUB</a> — <a href="https://digitalfarmers.be" target="_blank" style="color:#6366f1;">Digital Farmers</a>
        </p>
    </div>
    <?php
}

// ─── Connection Check ───
function tinyeclipse_check_connection($tenant_id) {
    if (empty($tenant_id)) return 'no_id';

    $response = wp_remote_get(TINYECLIPSE_API_BASE . '/api/sites/verify/' . $tenant_id, [
        'timeout' => 10,
    ]);

    if (is_wp_error($response)) return 'error';
    $code = wp_remote_retrieve_response_code($response);
    return ($code >= 200 && $code < 300) ? 'connected' : 'error';
}

// ─── Frontend: Inject Widget ───
add_action('wp_footer', function () {
    if (is_admin()) return;
    if (!get_option('tinyeclipse_enabled', false)) return;

    $tenant_id = get_option('tinyeclipse_tenant_id', '');
    if (empty($tenant_id)) return;

    // Check excluded roles
    if (is_user_logged_in()) {
        $user = wp_get_current_user();
        $exclude_roles = get_option('tinyeclipse_exclude_roles', ['administrator']);
        if (array_intersect($user->roles, (array)$exclude_roles)) return;
    }

    // Check excluded pages
    $exclude_pages = get_option('tinyeclipse_exclude_pages', '');
    if (!empty($exclude_pages)) {
        $current_path = wp_parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $excluded = array_filter(array_map('trim', explode("\n", $exclude_pages)));
        foreach ($excluded as $path) {
            if ($path && strpos($current_path, $path) === 0) return;
        }
    }

    $color = esc_attr(get_option('tinyeclipse_color', '#6C3CE1'));
    $name = esc_attr(get_option('tinyeclipse_name', get_bloginfo('name') . ' AI'));
    $lang = esc_attr(get_option('tinyeclipse_lang', 'nl'));
    $position = esc_attr(get_option('tinyeclipse_position', 'bottom-right'));

    echo '<script src="' . esc_url(TINYECLIPSE_API_BASE . '/widget/v1/widget.js') . '"'
        . ' data-tenant="' . esc_attr($tenant_id) . '"'
        . ' data-api="' . esc_url(TINYECLIPSE_API_BASE) . '"'
        . ' data-color="' . $color . '"'
        . ' data-name="' . $name . '"'
        . ' data-lang="' . $lang . '"'
        . ' data-position="' . $position . '"'
        . ' async></script>' . "\n";
}, 999);

// ─── REST API: Widget Config Endpoint ───
add_action('rest_api_init', function () {
    register_rest_route('tinyeclipse/v1', '/config', [
        'methods' => 'GET',
        'callback' => function () {
            return new WP_REST_Response([
                'tenant_id' => get_option('tinyeclipse_tenant_id', ''),
                'enabled' => (bool)get_option('tinyeclipse_enabled', false),
                'color' => get_option('tinyeclipse_color', '#6C3CE1'),
                'name' => get_option('tinyeclipse_name', get_bloginfo('name') . ' AI'),
                'lang' => get_option('tinyeclipse_lang', 'nl'),
                'position' => get_option('tinyeclipse_position', 'bottom-right'),
                'version' => TINYECLIPSE_VERSION,
                'site_url' => get_site_url(),
                'site_name' => get_bloginfo('name'),
            ], 200);
        },
        'permission_callback' => '__return_true',
    ]);
});

// ─── Activation Hook ───
register_activation_hook(__FILE__, function () {
    add_option('tinyeclipse_enabled', false);
    add_option('tinyeclipse_color', '#6C3CE1');
    add_option('tinyeclipse_lang', 'nl');
    add_option('tinyeclipse_position', 'bottom-right');
    add_option('tinyeclipse_exclude_roles', ['administrator']);
});

// ─── Deactivation Hook ───
register_deactivation_hook(__FILE__, function () {
    // Keep settings so they persist if re-activated
});

// ─── Uninstall: clean up all options ───
// See uninstall.php
