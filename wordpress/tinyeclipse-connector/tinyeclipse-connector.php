<?php
/**
 * Plugin Name: TinyEclipse Connector
 * Plugin URI: https://tinyeclipse.digitalfarmers.be
 * Description: Connect your WordPress site to TinyEclipse — AI Chat, Visitor Tracking, Proactive Help & 24/7 Monitoring by Digital Farmers.
 * Version: 2.0.0
 * Author: Digital Farmers
 * Author URI: https://digitalfarmers.be
 * License: GPL v2 or later
 * Text Domain: tinyeclipse
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) exit;

define('TINYECLIPSE_VERSION', '4.0.0');
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

// ═══════════════════════════════════════════════════════════════
// MODULE EVENTS — Auto-report site activity to TinyEclipse Hub
// ═══════════════════════════════════════════════════════════════

/**
 * Detect if this site is a staging environment.
 * Checks WP_ENVIRONMENT_TYPE, domain prefix, and common staging indicators.
 */
function tinyeclipse_is_staging() {
    // WordPress 5.5+ environment type
    if (function_exists('wp_get_environment_type')) {
        $env = wp_get_environment_type();
        if (in_array($env, ['staging', 'development', 'local'])) return true;
    }
    // Domain-based detection
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
    if (strpos($host, 'staging.') === 0) return true;
    if (strpos($host, 'dev.') === 0) return true;
    if (strpos($host, 'test.') === 0) return true;
    if (strpos($host, '.local') !== false) return true;
    if (strpos($host, 'localhost') !== false) return true;
    return false;
}

/**
 * Send a module event to the TinyEclipse API.
 *
 * @param string $module_type  Module: jobs, shop, giftcard, forms, booking
 * @param string $event_type   Event: order_placed, form_submitted, job_application, etc.
 * @param string $title        Human-readable title
 * @param string $description  Optional description
 * @param array  $data         Flexible event data payload
 * @param string $source_url   URL where event originated
 */
function tinyeclipse_send_event($module_type, $event_type, $title, $description = '', $data = [], $source_url = '') {
    $tenant_id = get_option('tinyeclipse_tenant_id', '');
    if (empty($tenant_id)) return;

    $data['environment'] = tinyeclipse_is_staging() ? 'staging' : 'production';
    $data['site_url'] = get_site_url();
    $data['site_name'] = get_bloginfo('name');

    $body = [
        'module_type'  => $module_type,
        'event_type'   => $event_type,
        'title'        => $title,
        'description'  => $description,
        'data'         => $data,
        'source_url'   => $source_url ?: get_site_url(),
    ];

    wp_remote_post(TINYECLIPSE_API_BASE . '/api/module-events/' . $tenant_id, [
        'timeout'  => 5,
        'blocking' => false,
        'headers'  => ['Content-Type' => 'application/json'],
        'body'     => wp_json_encode($body),
    ]);
}

// ─── WooCommerce: New Order ───
add_action('woocommerce_new_order', function ($order_id) {
    if (!function_exists('wc_get_order')) return;
    $order = wc_get_order($order_id);
    if (!$order) return;

    $total = $order->get_total();
    $items = $order->get_item_count();
    $billing_name = $order->get_billing_first_name() . ' ' . $order->get_billing_last_name();
    $email = $order->get_billing_email();

    tinyeclipse_send_event('shop', 'order_placed',
        "Nieuwe bestelling #{$order_id} — €{$total}",
        "{$items} artikel(en) door {$billing_name}",
        [
            'order_id'     => $order_id,
            'total'        => (float)$total,
            'currency'     => $order->get_currency(),
            'items'        => $items,
            'customer'     => $billing_name,
            'email'        => $email,
            'status'       => $order->get_status(),
            'payment'      => $order->get_payment_method_title(),
        ],
        $order->get_view_order_url()
    );
});

// ─── WooCommerce: Order Completed ───
add_action('woocommerce_order_status_completed', function ($order_id) {
    if (!function_exists('wc_get_order')) return;
    $order = wc_get_order($order_id);
    if (!$order) return;

    tinyeclipse_send_event('shop', 'order_completed',
        "Bestelling #{$order_id} afgerond — €" . $order->get_total(),
        $order->get_item_count() . ' artikel(en)',
        ['order_id' => $order_id, 'total' => (float)$order->get_total()]
    );
});

// ─── WooCommerce: Order Refunded ───
add_action('woocommerce_order_status_refunded', function ($order_id) {
    if (!function_exists('wc_get_order')) return;
    $order = wc_get_order($order_id);
    if (!$order) return;

    tinyeclipse_send_event('shop', 'order_refunded',
        "Bestelling #{$order_id} terugbetaald — €" . $order->get_total(),
        '',
        ['order_id' => $order_id, 'total' => (float)$order->get_total()]
    );
});

// ─── FluentForms: Form Submitted ───
add_action('fluentform/submission_inserted', function ($submission_id, $form_data, $form) {
    $form_title = isset($form->title) ? $form->title : 'Formulier';
    $name = '';
    $email = '';

    // Try to extract name/email from common field names
    foreach (['name', 'naam', 'full_name', 'your-name'] as $key) {
        if (!empty($form_data[$key])) { $name = $form_data[$key]; break; }
    }
    foreach (['email', 'e-mail', 'your-email', 'mail'] as $key) {
        if (!empty($form_data[$key])) { $email = $form_data[$key]; break; }
    }

    $desc = $name ? "Door {$name}" : '';
    if ($email && $desc) $desc .= " ({$email})";
    elseif ($email) $desc = $email;

    tinyeclipse_send_event('forms', 'form_submitted',
        "Formulier ingevuld: {$form_title}",
        $desc,
        [
            'form_id'       => isset($form->id) ? $form->id : null,
            'form_title'    => $form_title,
            'submission_id' => $submission_id,
            'name'          => $name,
            'email'         => $email,
            'field_count'   => count($form_data),
        ]
    );
}, 10, 3);

// ─── Contact Form 7: Form Submitted ───
add_action('wpcf7_mail_sent', function ($contact_form) {
    $submission = class_exists('WPCF7_Submission') ? WPCF7_Submission::get_instance() : null;
    $data = $submission ? $submission->get_posted_data() : [];
    $form_title = $contact_form->title();

    $name = '';
    $email = '';
    foreach (['your-name', 'name', 'naam'] as $key) {
        if (!empty($data[$key])) { $name = $data[$key]; break; }
    }
    foreach (['your-email', 'email', 'e-mail'] as $key) {
        if (!empty($data[$key])) { $email = $data[$key]; break; }
    }

    $desc = $name ? "Door {$name}" : '';
    if ($email && $desc) $desc .= " ({$email})";
    elseif ($email) $desc = $email;

    tinyeclipse_send_event('forms', 'form_submitted',
        "Contactformulier: {$form_title}",
        $desc,
        [
            'form_id'    => $contact_form->id(),
            'form_title' => $form_title,
            'name'       => $name,
            'email'      => $email,
        ]
    );
});

// ─── WP Job Manager: Job Application ───
add_action('new_job_application', function ($application_id, $job_id) {
    $application = get_post($application_id);
    $job = get_post($job_id);
    $job_title = $job ? $job->post_title : 'Onbekende vacature';
    $applicant = $application ? $application->post_title : 'Onbekend';

    tinyeclipse_send_event('jobs', 'job_application',
        "Sollicitatie ontvangen: {$job_title}",
        "Door {$applicant}",
        [
            'application_id' => $application_id,
            'job_id'         => $job_id,
            'job_title'      => $job_title,
            'applicant'      => $applicant,
        ],
        get_permalink($job_id)
    );
}, 10, 2);

// ─── WP Job Manager: Job Published ───
add_action('publish_job_listing', function ($post_id) {
    $job = get_post($post_id);
    if (!$job) return;

    tinyeclipse_send_event('jobs', 'job_published',
        "Vacature gepubliceerd: {$job->post_title}",
        '',
        ['job_id' => $post_id, 'job_title' => $job->post_title],
        get_permalink($post_id)
    );
});

// ─── Generic: Gravity Forms ───
add_action('gform_after_submission', function ($entry, $form) {
    $form_title = isset($form['title']) ? $form['title'] : 'Formulier';

    tinyeclipse_send_event('forms', 'form_submitted',
        "Formulier ingevuld: {$form_title}",
        '',
        [
            'form_id'    => isset($form['id']) ? $form['id'] : null,
            'form_title' => $form_title,
            'entry_id'   => isset($entry['id']) ? $entry['id'] : null,
        ]
    );
}, 10, 2);

// ═══════════════════════════════════════════════════════════════
// ECLIPSE REST API v3 — Remote management endpoints for Hub
// ═══════════════════════════════════════════════════════════════

/**
 * Verify Eclipse Hub request via tenant_id match.
 */
function tinyeclipse_verify_request($request) {
    $tenant = $request->get_header('X-Tenant-Id');
    $stored = get_option('tinyeclipse_tenant_id', '');
    if (empty($stored) || $tenant !== $stored) {
        return new WP_Error('unauthorized', 'Invalid tenant', ['status' => 403]);
    }
    return true;
}

add_action('rest_api_init', function () {

    // ─── WPML: Get languages ───
    register_rest_route('tinyeclipse/v1', '/wpml/languages', [
        'methods' => 'GET',
        'callback' => function () {
            if (!function_exists('icl_get_languages')) {
                return new WP_REST_Response(['active' => false, 'message' => 'WPML not installed'], 200);
            }
            $langs = icl_get_languages('skip_missing=0');
            $default = apply_filters('wpml_default_language', null);
            return new WP_REST_Response([
                'active' => true,
                'default_language' => $default,
                'languages' => array_map(function ($l) {
                    return [
                        'code' => $l['code'],
                        'name' => $l['native_name'],
                        'english_name' => $l['translated_name'],
                        'active' => (bool)$l['active'],
                        'url' => $l['url'],
                        'missing' => (int)($l['missing'] ?? 0),
                    ];
                }, array_values($langs)),
                'total' => count($langs),
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── WPML: Get translation status for pages ───
    register_rest_route('tinyeclipse/v1', '/wpml/status', [
        'methods' => 'GET',
        'callback' => function () {
            if (!function_exists('icl_get_languages')) {
                return new WP_REST_Response(['active' => false], 200);
            }
            global $wpdb;
            $default_lang = apply_filters('wpml_default_language', null);
            $langs = icl_get_languages('skip_missing=0');

            // Get all published pages/posts in default language
            $pages = get_posts([
                'post_type' => ['page', 'post'],
                'post_status' => 'publish',
                'numberposts' => 200,
                'suppress_filters' => false,
            ]);

            $items = [];
            foreach ($pages as $page) {
                $trid = apply_filters('wpml_element_trid', null, $page->ID, 'post_' . $page->post_type);
                $translations = apply_filters('wpml_get_element_translations', null, $trid, 'post_' . $page->post_type);
                $trans_status = [];
                if ($translations) {
                    foreach ($translations as $lang_code => $t) {
                        $trans_status[$lang_code] = [
                            'exists' => !empty($t->element_id),
                            'post_id' => $t->element_id ?? null,
                            'status' => !empty($t->element_id) ? get_post_status($t->element_id) : 'missing',
                        ];
                    }
                }
                $items[] = [
                    'id' => $page->ID,
                    'title' => $page->post_title,
                    'type' => $page->post_type,
                    'url' => get_permalink($page->ID),
                    'translations' => $trans_status,
                ];
            }

            return new WP_REST_Response([
                'active' => true,
                'default_language' => $default_lang,
                'language_count' => count($langs),
                'page_count' => count($items),
                'pages' => $items,
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Fluent Forms: List forms ───
    register_rest_route('tinyeclipse/v1', '/forms', [
        'methods' => 'GET',
        'callback' => function () {
            if (!function_exists('wpFluent')) {
                return new WP_REST_Response(['active' => false, 'message' => 'Fluent Forms not installed', 'forms' => []], 200);
            }
            global $wpdb;
            $table = $wpdb->prefix . 'fluentform_forms';
            $forms = $wpdb->get_results("SELECT id, title, status, created_at, updated_at FROM {$table} ORDER BY id DESC LIMIT 100");

            $result = [];
            foreach ($forms as $form) {
                $sub_table = $wpdb->prefix . 'fluentform_submissions';
                $count = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$sub_table} WHERE form_id = %d", $form->id));
                $recent = $wpdb->get_var($wpdb->prepare("SELECT created_at FROM {$sub_table} WHERE form_id = %d ORDER BY id DESC LIMIT 1", $form->id));

                $result[] = [
                    'id' => (int)$form->id,
                    'title' => $form->title,
                    'status' => $form->status,
                    'submissions' => (int)$count,
                    'last_submission' => $recent,
                    'created_at' => $form->created_at,
                ];
            }

            return new WP_REST_Response([
                'active' => true,
                'total' => count($result),
                'forms' => $result,
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Fluent Forms: Get submissions for a form ───
    register_rest_route('tinyeclipse/v1', '/forms/(?P<form_id>\d+)/submissions', [
        'methods' => 'GET',
        'callback' => function ($request) {
            if (!function_exists('wpFluent')) {
                return new WP_REST_Response(['active' => false], 200);
            }
            global $wpdb;
            $form_id = (int)$request['form_id'];
            $limit = min((int)($request->get_param('limit') ?: 50), 200);
            $table = $wpdb->prefix . 'fluentform_submissions';

            $subs = $wpdb->get_results($wpdb->prepare(
                "SELECT id, serial_number, response, status, created_at FROM {$table} WHERE form_id = %d ORDER BY id DESC LIMIT %d",
                $form_id, $limit
            ));

            $result = [];
            foreach ($subs as $sub) {
                $response = json_decode($sub->response, true) ?: [];
                $result[] = [
                    'id' => (int)$sub->id,
                    'serial' => $sub->serial_number,
                    'status' => $sub->status,
                    'fields' => $response,
                    'created_at' => $sub->created_at,
                ];
            }

            return new WP_REST_Response([
                'form_id' => $form_id,
                'total' => count($result),
                'submissions' => $result,
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── WooCommerce: Products overview ───
    register_rest_route('tinyeclipse/v1', '/shop/products', [
        'methods' => 'GET',
        'callback' => function ($request) {
            if (!class_exists('WooCommerce')) {
                return new WP_REST_Response(['active' => false, 'message' => 'WooCommerce not installed'], 200);
            }
            $limit = min((int)($request->get_param('limit') ?: 100), 200);
            $products = wc_get_products([
                'limit' => $limit,
                'status' => 'publish',
                'orderby' => 'date',
                'order' => 'DESC',
            ]);

            $result = [];
            foreach ($products as $p) {
                $result[] = [
                    'id' => $p->get_id(),
                    'name' => $p->get_name(),
                    'slug' => $p->get_slug(),
                    'type' => $p->get_type(),
                    'status' => $p->get_status(),
                    'price' => $p->get_price(),
                    'regular_price' => $p->get_regular_price(),
                    'sale_price' => $p->get_sale_price(),
                    'stock_status' => $p->get_stock_status(),
                    'stock_quantity' => $p->get_stock_quantity(),
                    'total_sales' => $p->get_total_sales(),
                    'categories' => wp_list_pluck($p->get_category_ids() ? get_terms(['taxonomy' => 'product_cat', 'include' => $p->get_category_ids()]) : [], 'name'),
                    'image' => wp_get_attachment_url($p->get_image_id()) ?: null,
                    'url' => $p->get_permalink(),
                    'created_at' => $p->get_date_created() ? $p->get_date_created()->format('c') : null,
                ];
            }

            return new WP_REST_Response([
                'active' => true,
                'total' => count($result),
                'products' => $result,
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── WooCommerce: Orders overview ───
    register_rest_route('tinyeclipse/v1', '/shop/orders', [
        'methods' => 'GET',
        'callback' => function ($request) {
            if (!class_exists('WooCommerce')) {
                return new WP_REST_Response(['active' => false], 200);
            }
            $limit = min((int)($request->get_param('limit') ?: 50), 200);
            $status = $request->get_param('status') ?: 'any';

            $orders = wc_get_orders([
                'limit' => $limit,
                'status' => $status,
                'orderby' => 'date',
                'order' => 'DESC',
            ]);

            $result = [];
            foreach ($orders as $o) {
                $items = [];
                foreach ($o->get_items() as $item) {
                    $items[] = [
                        'name' => $item->get_name(),
                        'quantity' => $item->get_quantity(),
                        'total' => $item->get_total(),
                    ];
                }
                $result[] = [
                    'id' => $o->get_id(),
                    'status' => $o->get_status(),
                    'total' => $o->get_total(),
                    'currency' => $o->get_currency(),
                    'items_count' => $o->get_item_count(),
                    'items' => $items,
                    'customer' => $o->get_billing_first_name() . ' ' . $o->get_billing_last_name(),
                    'email' => $o->get_billing_email(),
                    'payment_method' => $o->get_payment_method_title(),
                    'created_at' => $o->get_date_created() ? $o->get_date_created()->format('c') : null,
                ];
            }

            return new WP_REST_Response([
                'active' => true,
                'total' => count($result),
                'orders' => $result,
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── WooCommerce: Shop stats ───
    register_rest_route('tinyeclipse/v1', '/shop/stats', [
        'methods' => 'GET',
        'callback' => function ($request) {
            if (!class_exists('WooCommerce')) {
                return new WP_REST_Response(['active' => false], 200);
            }
            global $wpdb;
            $days = min((int)($request->get_param('days') ?: 30), 365);
            $since = date('Y-m-d H:i:s', strtotime("-{$days} days"));

            // Revenue
            $revenue = $wpdb->get_var($wpdb->prepare(
                "SELECT SUM(meta_value) FROM {$wpdb->postmeta} pm
                 JOIN {$wpdb->posts} p ON p.ID = pm.post_id
                 WHERE pm.meta_key = '_order_total'
                 AND p.post_type = 'shop_order'
                 AND p.post_status IN ('wc-completed','wc-processing')
                 AND p.post_date >= %s", $since
            ));

            // Order count
            $order_count = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->posts}
                 WHERE post_type = 'shop_order'
                 AND post_status IN ('wc-completed','wc-processing')
                 AND post_date >= %s", $since
            ));

            // Product count
            $product_count = $wpdb->get_var(
                "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'product' AND post_status = 'publish'"
            );

            // Top products by sales
            $top_products = $wpdb->get_results($wpdb->prepare(
                "SELECT pm.meta_value as product_id, p2.post_title as name,
                        SUM(oim.meta_value) as quantity, COUNT(DISTINCT oi.order_id) as orders
                 FROM {$wpdb->prefix}woocommerce_order_items oi
                 JOIN {$wpdb->prefix}woocommerce_order_itemmeta oim ON oim.order_item_id = oi.order_item_id AND oim.meta_key = '_qty'
                 JOIN {$wpdb->prefix}woocommerce_order_itemmeta pm ON pm.order_item_id = oi.order_item_id AND pm.meta_key = '_product_id'
                 JOIN {$wpdb->posts} p ON p.ID = oi.order_id AND p.post_status IN ('wc-completed','wc-processing') AND p.post_date >= %s
                 JOIN {$wpdb->posts} p2 ON p2.ID = pm.meta_value
                 WHERE oi.order_item_type = 'line_item'
                 GROUP BY pm.meta_value ORDER BY quantity DESC LIMIT 10", $since
            ));

            // Orders by status
            $by_status = $wpdb->get_results(
                "SELECT post_status as status, COUNT(*) as count FROM {$wpdb->posts}
                 WHERE post_type = 'shop_order' GROUP BY post_status"
            );

            return new WP_REST_Response([
                'active' => true,
                'period_days' => $days,
                'revenue' => round((float)$revenue, 2),
                'order_count' => (int)$order_count,
                'product_count' => (int)$product_count,
                'avg_order_value' => $order_count > 0 ? round((float)$revenue / $order_count, 2) : 0,
                'top_products' => array_map(function ($p) {
                    return [
                        'id' => (int)$p->product_id,
                        'name' => $p->name,
                        'quantity' => (int)$p->quantity,
                        'orders' => (int)$p->orders,
                    ];
                }, $top_products ?: []),
                'by_status' => array_reduce($by_status ?: [], function ($carry, $s) {
                    $carry[str_replace('wc-', '', $s->status)] = (int)$s->count;
                    return $carry;
                }, []),
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Mail/SMTP status ───
    register_rest_route('tinyeclipse/v1', '/mail/status', [
        'methods' => 'GET',
        'callback' => function () {
            $smtp_plugins = [
                'wp-mail-smtp/wp_mail_smtp.php' => 'WP Mail SMTP',
                'fluent-smtp/fluent-smtp.php' => 'FluentSMTP',
                'post-smtp/postman-smtp.php' => 'Post SMTP',
                'easy-wp-smtp/easy-wp-smtp.php' => 'Easy WP SMTP',
            ];

            $active_smtp = null;
            $active_plugins = get_option('active_plugins', []);
            foreach ($smtp_plugins as $file => $name) {
                if (in_array($file, $active_plugins)) {
                    $active_smtp = $name;
                    break;
                }
            }

            // Check FluentSMTP settings if available
            $smtp_config = [];
            if ($active_smtp === 'FluentSMTP') {
                $settings = get_option('fluentmail-settings', []);
                if (!empty($settings['connections'])) {
                    foreach ($settings['connections'] as $key => $conn) {
                        $smtp_config[] = [
                            'sender' => $key,
                            'provider' => $conn['provider_settings']['provider'] ?? 'unknown',
                            'from_email' => $conn['provider_settings']['sender_email'] ?? '',
                        ];
                    }
                }
            }

            // Get admin email
            $admin_email = get_option('admin_email', '');
            $woo_email = '';
            if (class_exists('WooCommerce')) {
                $woo_email = get_option('woocommerce_email_from_address', $admin_email);
            }

            return new WP_REST_Response([
                'smtp_active' => !empty($active_smtp),
                'smtp_plugin' => $active_smtp,
                'smtp_connections' => $smtp_config,
                'admin_email' => $admin_email,
                'woo_email' => $woo_email,
                'site_name' => get_bloginfo('name'),
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ═══════════════════════════════════════════════════════════════
    // ECLIPSE v4 — Full Sync + Write Endpoints
    // ═══════════════════════════════════════════════════════════════

    // ─── Full Sync: dump all data to Eclipse ───
    register_rest_route('tinyeclipse/v1', '/sync/full', [
        'methods' => 'POST',
        'callback' => function () {
            $tenant_id = get_option('tinyeclipse_tenant_id', '');
            if (empty($tenant_id)) {
                return new WP_REST_Response(['error' => 'No tenant configured'], 400);
            }

            $data = ['tenant_id' => $tenant_id, 'site_url' => get_site_url(), 'synced_at' => current_time('c')];

            // 1. All WooCommerce orders (last 500)
            $data['orders'] = [];
            if (class_exists('WooCommerce')) {
                $orders = wc_get_orders(['limit' => 500, 'orderby' => 'date', 'order' => 'DESC']);
                foreach ($orders as $o) {
                    $data['orders'][] = [
                        'order_id' => $o->get_id(), 'status' => $o->get_status(),
                        'total' => (float)$o->get_total(), 'currency' => $o->get_currency(),
                        'items' => $o->get_item_count(),
                        'customer' => trim($o->get_billing_first_name() . ' ' . $o->get_billing_last_name()),
                        'email' => $o->get_billing_email(),
                        'phone' => $o->get_billing_phone(),
                        'city' => $o->get_billing_city(), 'country' => $o->get_billing_country(),
                        'address' => $o->get_billing_address_1(),
                        'payment' => $o->get_payment_method_title(),
                        'created_at' => $o->get_date_created() ? $o->get_date_created()->format('c') : null,
                    ];
                }
            }

            // 2. All WooCommerce customers
            $data['customers'] = [];
            if (class_exists('WooCommerce')) {
                $customers = get_users(['role' => 'customer', 'number' => 500]);
                foreach ($customers as $u) {
                    $data['customers'][] = [
                        'user_id' => $u->ID, 'email' => $u->user_email,
                        'name' => trim(get_user_meta($u->ID, 'billing_first_name', true) . ' ' . get_user_meta($u->ID, 'billing_last_name', true)),
                        'phone' => get_user_meta($u->ID, 'billing_phone', true),
                        'city' => get_user_meta($u->ID, 'billing_city', true),
                        'country' => get_user_meta($u->ID, 'billing_country', true),
                        'order_count' => (int)get_user_meta($u->ID, '_order_count', true),
                        'total_spent' => (float)get_user_meta($u->ID, '_money_spent', true),
                        'registered' => $u->user_registered,
                    ];
                }
            }

            // 3. All form submissions (Fluent Forms)
            $data['form_submissions'] = [];
            if (function_exists('wpFluent')) {
                global $wpdb;
                $subs = $wpdb->get_results("SELECT s.id, s.form_id, s.response, s.status, s.created_at, f.title as form_title
                    FROM {$wpdb->prefix}fluentform_submissions s
                    LEFT JOIN {$wpdb->prefix}fluentform_forms f ON f.id = s.form_id
                    ORDER BY s.id DESC LIMIT 500");
                foreach ($subs as $sub) {
                    $fields = json_decode($sub->response, true) ?: [];
                    $email = ''; $name = ''; $phone = '';
                    foreach (['email', 'e-mail', 'your-email', 'mail'] as $k) { if (!empty($fields[$k])) { $email = $fields[$k]; break; } }
                    foreach (['name', 'naam', 'full_name', 'your-name'] as $k) { if (!empty($fields[$k])) { $name = $fields[$k]; break; } }
                    foreach (['phone', 'telefoon', 'tel', 'your-phone'] as $k) { if (!empty($fields[$k])) { $phone = $fields[$k]; break; } }
                    $data['form_submissions'][] = [
                        'id' => (int)$sub->id, 'form_id' => (int)$sub->form_id,
                        'form_title' => $sub->form_title, 'status' => $sub->status,
                        'email' => $email, 'name' => $name, 'phone' => $phone,
                        'fields' => $fields, 'created_at' => $sub->created_at,
                    ];
                }
            }

            // 4. All WordPress users
            $data['users'] = [];
            $users = get_users(['number' => 200]);
            foreach ($users as $u) {
                $data['users'][] = [
                    'user_id' => $u->ID, 'email' => $u->user_email,
                    'name' => $u->display_name, 'role' => implode(',', $u->roles),
                    'registered' => $u->user_registered,
                ];
            }

            // 5. Recent comments
            $data['comments'] = [];
            $comments = get_comments(['number' => 200, 'status' => 'approve']);
            foreach ($comments as $c) {
                $data['comments'][] = [
                    'id' => $c->comment_ID, 'author' => $c->comment_author,
                    'email' => $c->comment_author_email, 'content' => wp_strip_all_tags($c->comment_content),
                    'post_id' => $c->comment_post_ID, 'post_title' => get_the_title($c->comment_post_ID),
                    'created_at' => $c->comment_date,
                ];
            }

            // 6. Site metadata
            $active_plugins = get_option('active_plugins', []);
            $data['site_meta'] = [
                'name' => get_bloginfo('name'), 'description' => get_bloginfo('description'),
                'url' => get_site_url(), 'wp_version' => get_bloginfo('version'),
                'php_version' => phpversion(), 'theme' => get_stylesheet(),
                'locale' => get_locale(), 'timezone' => wp_timezone_string(),
                'plugin_count' => count($active_plugins),
                'plugins' => array_map(function ($p) { return explode('/', $p)[0]; }, $active_plugins),
            ];

            // Send to Eclipse API
            $response = wp_remote_post(TINYECLIPSE_API_BASE . '/api/admin/wp/' . $tenant_id . '/sync', [
                'timeout' => 60,
                'headers' => ['Content-Type' => 'application/json', 'X-Tenant-Id' => $tenant_id],
                'body' => wp_json_encode($data),
            ]);

            $status = is_wp_error($response) ? 'error' : wp_remote_retrieve_response_code($response);
            update_option('tinyeclipse_last_sync', current_time('c'));

            return new WP_REST_Response([
                'status' => $status == 200 ? 'synced' : 'error',
                'orders' => count($data['orders']),
                'customers' => count($data['customers']),
                'form_submissions' => count($data['form_submissions']),
                'users' => count($data['users']),
                'comments' => count($data['comments']),
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Write: Update page/post content ───
    register_rest_route('tinyeclipse/v1', '/pages/(?P<id>\d+)', [
        'methods' => 'POST',
        'callback' => function ($request) {
            $post_id = (int)$request['id'];
            $post = get_post($post_id);
            if (!$post) return new WP_REST_Response(['error' => 'Post not found'], 404);

            $params = $request->get_json_params();
            $update = ['ID' => $post_id];
            if (isset($params['title'])) $update['post_title'] = sanitize_text_field($params['title']);
            if (isset($params['content'])) $update['post_content'] = wp_kses_post($params['content']);
            if (isset($params['status'])) $update['post_status'] = sanitize_text_field($params['status']);
            if (isset($params['excerpt'])) $update['post_excerpt'] = sanitize_text_field($params['excerpt']);

            $result = wp_update_post($update, true);
            if (is_wp_error($result)) {
                return new WP_REST_Response(['error' => $result->get_error_message()], 500);
            }

            return new WP_REST_Response([
                'status' => 'updated', 'post_id' => $post_id,
                'title' => get_the_title($post_id), 'url' => get_permalink($post_id),
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Write: Update WooCommerce product ───
    register_rest_route('tinyeclipse/v1', '/products/(?P<id>\d+)', [
        'methods' => 'POST',
        'callback' => function ($request) {
            if (!class_exists('WooCommerce')) return new WP_REST_Response(['error' => 'WooCommerce not installed'], 400);
            $product = wc_get_product((int)$request['id']);
            if (!$product) return new WP_REST_Response(['error' => 'Product not found'], 404);

            $params = $request->get_json_params();
            if (isset($params['name'])) $product->set_name(sanitize_text_field($params['name']));
            if (isset($params['price'])) $product->set_regular_price(sanitize_text_field($params['price']));
            if (isset($params['sale_price'])) $product->set_sale_price(sanitize_text_field($params['sale_price']));
            if (isset($params['description'])) $product->set_description(wp_kses_post($params['description']));
            if (isset($params['short_description'])) $product->set_short_description(wp_kses_post($params['short_description']));
            if (isset($params['stock_status'])) $product->set_stock_status(sanitize_text_field($params['stock_status']));
            if (isset($params['stock_quantity'])) $product->set_stock_quantity((int)$params['stock_quantity']);
            if (isset($params['status'])) $product->set_status(sanitize_text_field($params['status']));

            $product->save();

            return new WP_REST_Response([
                'status' => 'updated', 'product_id' => $product->get_id(),
                'name' => $product->get_name(), 'price' => $product->get_price(),
                'url' => $product->get_permalink(),
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Write: Update order status ───
    register_rest_route('tinyeclipse/v1', '/orders/(?P<id>\d+)/status', [
        'methods' => 'POST',
        'callback' => function ($request) {
            if (!class_exists('WooCommerce')) return new WP_REST_Response(['error' => 'WooCommerce not installed'], 400);
            $order = wc_get_order((int)$request['id']);
            if (!$order) return new WP_REST_Response(['error' => 'Order not found'], 404);

            $params = $request->get_json_params();
            if (!empty($params['status'])) {
                $order->update_status(sanitize_text_field($params['status']), 'Status gewijzigd via Eclipse Hub');
            }
            if (!empty($params['note'])) {
                $order->add_order_note(sanitize_text_field($params['note']));
            }

            return new WP_REST_Response([
                'status' => 'updated', 'order_id' => $order->get_id(),
                'new_status' => $order->get_status(),
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Write: Update site options ───
    register_rest_route('tinyeclipse/v1', '/options', [
        'methods' => 'POST',
        'callback' => function ($request) {
            $params = $request->get_json_params();
            $updated = [];
            $allowed = ['blogname', 'blogdescription', 'woocommerce_email_from_address', 'woocommerce_email_from_name'];
            foreach ($params as $key => $value) {
                if (in_array($key, $allowed)) {
                    update_option($key, sanitize_text_field($value));
                    $updated[] = $key;
                }
            }
            return new WP_REST_Response(['status' => 'updated', 'options' => $updated], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Read: All pages/posts for content management ───
    register_rest_route('tinyeclipse/v1', '/content', [
        'methods' => 'GET',
        'callback' => function ($request) {
            $type = $request->get_param('type') ?: 'page';
            $limit = min((int)($request->get_param('limit') ?: 100), 200);
            $posts = get_posts([
                'post_type' => $type, 'post_status' => 'any',
                'numberposts' => $limit, 'orderby' => 'date', 'order' => 'DESC',
            ]);
            $result = [];
            foreach ($posts as $p) {
                $result[] = [
                    'id' => $p->ID, 'title' => $p->post_title, 'slug' => $p->post_name,
                    'status' => $p->post_status, 'type' => $p->post_type,
                    'content' => wp_strip_all_tags($p->post_content),
                    'excerpt' => $p->post_excerpt, 'url' => get_permalink($p->ID),
                    'modified' => $p->post_modified, 'author' => get_the_author_meta('display_name', $p->post_author),
                ];
            }
            return new WP_REST_Response(['total' => count($result), 'items' => $result], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Site overview: all capabilities ───
    register_rest_route('tinyeclipse/v1', '/capabilities', [
        'methods' => 'GET',
        'callback' => function () {
            $active_plugins = get_option('active_plugins', []);
            $has = function ($slug) use ($active_plugins) {
                foreach ($active_plugins as $p) {
                    if (strpos($p, $slug) !== false) return true;
                }
                return false;
            };

            return new WP_REST_Response([
                'wordpress' => true,
                'version' => get_bloginfo('version'),
                'php' => phpversion(),
                'woocommerce' => class_exists('WooCommerce'),
                'woo_version' => defined('WC_VERSION') ? WC_VERSION : null,
                'wpml' => function_exists('icl_get_languages'),
                'fluent_forms' => function_exists('wpFluent') || $has('fluentform'),
                'fluent_smtp' => $has('fluent-smtp'),
                'wp_mail_smtp' => $has('wp-mail-smtp'),
                'contact_form_7' => $has('contact-form-7'),
                'gravity_forms' => $has('gravityforms'),
                'job_manager' => $has('wp-job-manager'),
                'amelia_booking' => $has('ameliabooking'),
                'elementor' => $has('elementor'),
                'yoast' => $has('wordpress-seo'),
                'theme' => get_stylesheet(),
                'multisite' => is_multisite(),
                'locale' => get_locale(),
                'timezone' => wp_timezone_string(),
                'site_url' => get_site_url(),
                'home_url' => get_home_url(),
                'plugin_count' => count($active_plugins),
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);
});

// ─── Uninstall: clean up all options ───
// See uninstall.php
