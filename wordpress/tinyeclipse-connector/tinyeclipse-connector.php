<?php
/**
 * Plugin Name: TinyEclipse Connector
 * Plugin URI: https://tinyeclipse.digitalfarmers.be
 * Description: Core connector for TinyEclipse — AI-powered WordPress site management, security, SEO, mail, translation, jobs, forms & token system by Digital Farmers.
 * Version: 5.0.0
 * Author: Digital Farmers
 * Author URI: https://digitalfarmers.be
 * License: GPL v2 or later
 * Text Domain: tinyeclipse
 * Domain Path: /languages
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) exit;

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

define('TINYECLIPSE_VERSION', '5.0.0');
define('TINYECLIPSE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('TINYECLIPSE_PLUGIN_URL', plugin_dir_url(__FILE__));
define('TINYECLIPSE_API_BASE', 'https://api.tinyeclipse.digitalfarmers.be');
define('TINYECLIPSE_HUB_URL', 'https://tinyeclipse.digitalfarmers.be');

// ═══════════════════════════════════════════════════════════════
// GLOBAL HELPER FUNCTIONS — Used by add-on plugins (WC, Analytics)
// ═══════════════════════════════════════════════════════════════

function tinyeclipse_get_tenant_id() {
    return get_option('tinyeclipse_site_id', get_option('tinyeclipse_tenant_id', ''));
}

function tinyeclipse_is_staging() {
    if (function_exists('wp_get_environment_type')) {
        $env = wp_get_environment_type();
        if (in_array($env, ['staging', 'development', 'local'])) return true;
    }
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
    if (strpos($host, 'staging.') === 0 || strpos($host, 'dev.') === 0 || strpos($host, 'test.') === 0) return true;
    if (strpos($host, '.local') !== false || strpos($host, 'localhost') !== false) return true;
    return false;
}

function tinyeclipse_send_event($module_type, $event_type, $title, $description = '', $data = [], $source_url = '') {
    $tenant_id = tinyeclipse_get_tenant_id();
    if (empty($tenant_id)) return;

    $data['environment'] = tinyeclipse_is_staging() ? 'staging' : 'production';
    $data['site_url'] = get_site_url();
    $data['site_name'] = get_bloginfo('name');

    wp_remote_post(TINYECLIPSE_API_BASE . '/api/module-events/' . $tenant_id, [
        'timeout'  => 5,
        'blocking' => false,
        'headers'  => ['Content-Type' => 'application/json'],
        'body'     => wp_json_encode([
            'module_type' => $module_type, 'event_type' => $event_type,
            'title' => $title, 'description' => $description,
            'data' => $data, 'source_url' => $source_url ?: get_site_url(),
        ]),
    ]);
}

function tinyeclipse_verify_request($request) {
    // Hub key auth
    $hub_key = get_option('tinyeclipse_hub_api_key', '');
    $auth = $request->get_header('Authorization');
    if ($hub_key && $auth === 'Bearer ' . $hub_key) return true;

    // Tenant ID auth (backwards compat)
    $tenant = $request->get_header('X-Tenant-Id');
    $stored = tinyeclipse_get_tenant_id();
    if (!empty($stored) && $tenant === $stored) return true;

    return new WP_Error('unauthorized', 'Invalid auth', ['status' => 403]);
}

function tinyeclipse_log($module, $level, $message, $context = []) {
    global $wpdb;
    $table = $wpdb->prefix . 'tinyeclipse_logs';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) return;
    $wpdb->insert($table, [
        'module'     => $module,
        'level'      => $level,
        'message'    => $message,
        'context'    => wp_json_encode($context),
        'created_at' => current_time('mysql'),
    ]);
}

function tinyeclipse_is_superadmin() {
    if (!is_user_logged_in()) return false;
    $user = wp_get_current_user();
    if (!$user->has_cap('manage_options')) return false;
    $email = $user->user_email;
    $domains = ['@digitalfarmers.be', '@digitalfarmers.nl', '@tinyeclipse.'];
    foreach ($domains as $d) {
        if (strpos($email, $d) !== false) return true;
    }
    return false;
}

function tinyeclipse_is_shop_manager() {
    if (!is_user_logged_in()) return false;
    $user = wp_get_current_user();
    if (in_array('shop_manager', $user->roles)) return true;
    if ($user->has_cap('manage_woocommerce') && !$user->has_cap('manage_options')) return true;
    return false;
}

function tinyeclipse_get_eclipse_cap() {
    return 'manage_woocommerce';
}

// ═══════════════════════════════════════════════════════════════
// TOKEN SYSTEM — Global helpers
// ═══════════════════════════════════════════════════════════════

function tinyeclipse_get_token_balance($user_id = 0) {
    if (!$user_id) $user_id = get_current_user_id();
    if (!$user_id) return ['balance' => 0, 'tier' => 'free', 'lifetime_used' => 0];

    if (class_exists('TinyEclipse_Tokens')) {
        return TinyEclipse_Tokens::instance()->get_balance($user_id);
    }
    return ['balance' => 0, 'tier' => 'free', 'lifetime_used' => 0];
}

function tinyeclipse_deduct_tokens($action, $user_id = 0) {
    if (!$user_id) $user_id = get_current_user_id();
    if (!$user_id) return new WP_Error('no_user', 'No user');

    if (class_exists('TinyEclipse_Tokens')) {
        return TinyEclipse_Tokens::instance()->deduct($action, $user_id);
    }
    return new WP_Error('no_tokens', 'Token system not loaded');
}

// ═══════════════════════════════════════════════════════════════
// LOAD MODULE CLASSES
// ═══════════════════════════════════════════════════════════════

$te_includes = TINYECLIPSE_PLUGIN_DIR . 'includes/';

require_once $te_includes . 'class-tinyeclipse-hub.php';
require_once $te_includes . 'class-tinyeclipse-security.php';
require_once $te_includes . 'class-tinyeclipse-seo.php';
require_once $te_includes . 'class-tinyeclipse-mail.php';
require_once $te_includes . 'class-tinyeclipse-collector.php';
require_once $te_includes . 'class-tinyeclipse-translation.php';
require_once $te_includes . 'class-tinyeclipse-translator.php';
require_once $te_includes . 'class-tinyeclipse-jobs.php';
require_once $te_includes . 'class-tinyeclipse-forms.php';
require_once $te_includes . 'class-tinyeclipse-tokens.php';
require_once $te_includes . 'class-tinyeclipse-rest-api.php';

if (is_admin()) {
    require_once $te_includes . 'class-tinyeclipse-admin.php';
}

// ═══════════════════════════════════════════════════════════════
// INIT ALL MODULES
// ═══════════════════════════════════════════════════════════════

add_action('init', function () {
    TinyEclipse_Hub::instance();
    TinyEclipse_Security::instance();
    TinyEclipse_SEO::instance();
    TinyEclipse_Mail::instance();
    TinyEclipse_Collector::instance();
    TinyEclipse_Translation::instance();
    TinyEclipse_Translator::instance();
    TinyEclipse_Jobs::instance();
    TinyEclipse_Forms::instance();
    TinyEclipse_Tokens::instance();

    if (is_admin()) {
        TinyEclipse_Admin::instance();
    }

    do_action('tinyeclipse_loaded');
}, 5);

// REST routes
add_action('rest_api_init', function () {
    TinyEclipse_REST_API::register_routes();
});

// ═══════════════════════════════════════════════════════════════
// CRON JOBS
// ═══════════════════════════════════════════════════════════════

add_filter('cron_schedules', function ($schedules) {
    $schedules['tinyeclipse_hourly'] = ['interval' => 3600, 'display' => 'Hourly (TinyEclipse)'];
    return $schedules;
});

add_action('init', function () {
    if (!wp_next_scheduled('tinyeclipse_hourly_scan')) {
        wp_schedule_event(time(), 'tinyeclipse_hourly', 'tinyeclipse_hourly_scan');
    }
    if (!wp_next_scheduled('tinyeclipse_daily_report')) {
        wp_schedule_event(time(), 'daily', 'tinyeclipse_daily_report');
    }
    if (!wp_next_scheduled('tinyeclipse_command_poll')) {
        wp_schedule_event(time(), 'tinyeclipse_hourly', 'tinyeclipse_command_poll');
    }
});

add_action('tinyeclipse_hourly_scan', function () {
    if (class_exists('TinyEclipse_Collector')) {
        TinyEclipse_Collector::instance()->run_hourly_scan();
    }
});

add_action('tinyeclipse_daily_report', function () {
    if (class_exists('TinyEclipse_Collector')) {
        TinyEclipse_Collector::instance()->run_daily_report();
    }
});

add_action('tinyeclipse_command_poll', function () {
    if (class_exists('TinyEclipse_Hub')) {
        TinyEclipse_Hub::instance()->poll_commands();
    }
});

// ═══════════════════════════════════════════════════════════════
// MODULE EVENT HOOKS — Forms, Jobs, etc.
// ═══════════════════════════════════════════════════════════════

add_action('fluentform/submission_inserted', function ($submission_id, $form_data, $form) {
    $form_title = isset($form->title) ? $form->title : 'Formulier';
    $name = $email = '';
    foreach (['name', 'naam', 'full_name', 'your-name'] as $key) { if (!empty($form_data[$key])) { $name = $form_data[$key]; break; } }
    foreach (['email', 'e-mail', 'your-email', 'mail'] as $key) { if (!empty($form_data[$key])) { $email = $form_data[$key]; break; } }
    $desc = $name ? "Door {$name}" : '';
    if ($email && $desc) $desc .= " ({$email})"; elseif ($email) $desc = $email;
    tinyeclipse_send_event('forms', 'form_submitted', "Formulier ingevuld: {$form_title}", $desc, [
        'form_id' => isset($form->id) ? $form->id : null, 'form_title' => $form_title,
        'submission_id' => $submission_id, 'name' => $name, 'email' => $email, 'field_count' => count($form_data),
    ]);
}, 10, 3);

add_action('wpcf7_mail_sent', function ($contact_form) {
    $submission = class_exists('WPCF7_Submission') ? WPCF7_Submission::get_instance() : null;
    $data = $submission ? $submission->get_posted_data() : [];
    $form_title = $contact_form->title();
    $name = $email = '';
    foreach (['your-name', 'name', 'naam'] as $key) { if (!empty($data[$key])) { $name = $data[$key]; break; } }
    foreach (['your-email', 'email', 'e-mail'] as $key) { if (!empty($data[$key])) { $email = $data[$key]; break; } }
    $desc = $name ? "Door {$name}" : '';
    if ($email && $desc) $desc .= " ({$email})"; elseif ($email) $desc = $email;
    tinyeclipse_send_event('forms', 'form_submitted', "Contactformulier: {$form_title}", $desc, [
        'form_id' => $contact_form->id(), 'form_title' => $form_title, 'name' => $name, 'email' => $email,
    ]);
});

add_action('new_job_application', function ($application_id, $job_id) {
    $job = get_post($job_id);
    $applicant = get_post($application_id);
    tinyeclipse_send_event('jobs', 'job_application', "Sollicitatie: " . ($job ? $job->post_title : 'Onbekend'),
        "Door " . ($applicant ? $applicant->post_title : 'Onbekend'), [
        'application_id' => $application_id, 'job_id' => $job_id,
    ], get_permalink($job_id));
}, 10, 2);

add_action('publish_job_listing', function ($post_id) {
    $job = get_post($post_id);
    if ($job) tinyeclipse_send_event('jobs', 'job_published', "Vacature: {$job->post_title}", '', ['job_id' => $post_id], get_permalink($post_id));
});

add_action('gform_after_submission', function ($entry, $form) {
    $title = isset($form['title']) ? $form['title'] : 'Formulier';
    tinyeclipse_send_event('forms', 'form_submitted', "Formulier: {$title}", '', [
        'form_id' => $form['id'] ?? null, 'form_title' => $title, 'entry_id' => $entry['id'] ?? null,
    ]);
}, 10, 2);

// ═══════════════════════════════════════════════════════════════
// ACTIVATION / DEACTIVATION / MIGRATION
// ═══════════════════════════════════════════════════════════════

register_activation_hook(__FILE__, function () {
    global $wpdb;
    $charset = $wpdb->get_charset_collate();
    $prefix = $wpdb->prefix;

    // Create DB tables
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';

    dbDelta("CREATE TABLE {$prefix}tinyeclipse_logs (
        id BIGINT UNSIGNED AUTO_INCREMENT,
        module VARCHAR(50) NOT NULL DEFAULT 'core',
        level VARCHAR(20) NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        context TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_module (module),
        KEY idx_level (level),
        KEY idx_created (created_at)
    ) {$charset};");

    dbDelta("CREATE TABLE {$prefix}tinyeclipse_reports (
        id BIGINT UNSIGNED AUTO_INCREMENT,
        report_type VARCHAR(50) NOT NULL DEFAULT 'daily',
        data LONGTEXT NOT NULL,
        score INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_type (report_type),
        KEY idx_created (created_at)
    ) {$charset};");

    dbDelta("CREATE TABLE {$prefix}tinyeclipse_mail_log (
        id BIGINT UNSIGNED AUTO_INCREMENT,
        to_email VARCHAR(255) NOT NULL,
        subject VARCHAR(500) DEFAULT '',
        status VARCHAR(20) DEFAULT 'sent',
        provider VARCHAR(50) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_created (created_at)
    ) {$charset};");

    dbDelta("CREATE TABLE {$prefix}tinyeclipse_security (
        id BIGINT UNSIGNED AUTO_INCREMENT,
        check_type VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pass',
        details TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_type (check_type),
        KEY idx_created (created_at)
    ) {$charset};");

    dbDelta("CREATE TABLE {$prefix}tinyeclipse_tokens (
        user_id BIGINT UNSIGNED NOT NULL,
        balance INT NOT NULL DEFAULT 0,
        lifetime_used INT NOT NULL DEFAULT 0,
        tier VARCHAR(20) NOT NULL DEFAULT 'free',
        monthly_reset DATE DEFAULT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id)
    ) {$charset};");

    dbDelta("CREATE TABLE {$prefix}tinyeclipse_token_log (
        id BIGINT UNSIGNED AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        action VARCHAR(50) NOT NULL,
        tokens_used INT NOT NULL DEFAULT 0,
        balance_after INT NOT NULL DEFAULT 0,
        description VARCHAR(255) DEFAULT '',
        meta TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_user (user_id),
        KEY idx_created (created_at)
    ) {$charset};");

    // Default options
    add_option('tinyeclipse_enabled', false);
    add_option('tinyeclipse_color', '#6C3CE1');
    add_option('tinyeclipse_lang', 'nl');
    add_option('tinyeclipse_position', 'bottom-right');
    add_option('tinyeclipse_exclude_roles', ['administrator']);
    add_option('tinyeclipse_modules', []);
    add_option('tinyeclipse_auto_report', true);
    add_option('tinyeclipse_log_retention', 30);

    // Migrate from eclipse_ai_* if exists
    tinyeclipse_migrate_from_eclipse_ai();

    // Flush rewrite rules
    flush_rewrite_rules();
});

register_deactivation_hook(__FILE__, function () {
    wp_clear_scheduled_hook('tinyeclipse_hourly_scan');
    wp_clear_scheduled_hook('tinyeclipse_daily_report');
    wp_clear_scheduled_hook('tinyeclipse_command_poll');
});

function tinyeclipse_migrate_from_eclipse_ai() {
    global $wpdb;

    // Migrate options
    $option_map = [
        'eclipse_ai_hub_url'           => 'tinyeclipse_hub_url',
        'eclipse_ai_hub_api_key'       => 'tinyeclipse_hub_api_key',
        'eclipse_ai_site_id'           => 'tinyeclipse_site_id',
        'eclipse_ai_modules'           => 'tinyeclipse_modules',
        'eclipse_ai_report_email'      => 'tinyeclipse_report_email',
        'eclipse_ai_auto_report'       => 'tinyeclipse_auto_report',
        'eclipse_ai_log_retention'     => 'tinyeclipse_log_retention',
        'eclipse_ai_translate_key'     => 'tinyeclipse_translate_key',
        'eclipse_ai_translate_provider' => 'tinyeclipse_translate_provider',
        'eclipse_ai_translate_model'   => 'tinyeclipse_translate_model',
    ];

    foreach ($option_map as $old => $new) {
        $val = get_option($old);
        if ($val !== false && get_option($new) === false) {
            update_option($new, $val);
            tinyeclipse_log('migration', 'info', "Migrated option {$old} → {$new}");
        }
    }

    // Migrate DB tables
    $table_map = [
        'eclipse_ai_logs'      => 'tinyeclipse_logs',
        'eclipse_ai_reports'   => 'tinyeclipse_reports',
        'eclipse_ai_mail_log'  => 'tinyeclipse_mail_log',
        'eclipse_ai_security'  => 'tinyeclipse_security',
        'eclipse_ai_tokens'    => 'tinyeclipse_tokens',
        'eclipse_ai_token_log' => 'tinyeclipse_token_log',
    ];

    foreach ($table_map as $old_suffix => $new_suffix) {
        $old_table = $wpdb->prefix . $old_suffix;
        $new_table = $wpdb->prefix . $new_suffix;
        if ($wpdb->get_var("SHOW TABLES LIKE '{$old_table}'") === $old_table) {
            $count = $wpdb->get_var("SELECT COUNT(*) FROM {$old_table}");
            if ($count > 0) {
                $new_count = $wpdb->get_var("SELECT COUNT(*) FROM {$new_table}");
                if ($new_count == 0) {
                    $wpdb->query("INSERT INTO {$new_table} SELECT * FROM {$old_table}");
                    tinyeclipse_log('migration', 'info', "Migrated {$count} rows from {$old_table} → {$new_table}");
                }
            }
        }
    }
}
