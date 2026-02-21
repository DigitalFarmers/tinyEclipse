<?php
/**
 * TinyEclipse Hub Connector
 * Handles communication with TinyEclipse Hub: fingerprint, onboarding, config push, domain pivot, command polling.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_Hub {
    private static $instance = null;

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {
        // Heartbeat on admin_init (once per hour max)
        add_action('admin_init', [$this, 'maybe_heartbeat']);
    }

    public function get_site_id() {
        return tinyeclipse_get_tenant_id();
    }

    public function get_hub_url() {
        return get_option('tinyeclipse_hub_url', TINYECLIPSE_HUB_URL);
    }

    public function get_hub_api_key() {
        return get_option('tinyeclipse_hub_api_key', '');
    }

    /**
     * Generate site fingerprint — unique identity for this WordPress installation.
     */
    public function get_fingerprint() {
        $active_plugins = get_option('active_plugins', []);
        $has_plugin = function ($slug) use ($active_plugins) {
            foreach ($active_plugins as $p) {
                if (strpos($p, $slug) !== false) return true;
            }
            return false;
        };

        $modules = [];
        if (class_exists('WooCommerce')) $modules[] = 'shop';
        if (function_exists('icl_get_languages')) $modules[] = 'wpml';
        if (function_exists('wpFluent') || $has_plugin('fluentform')) $modules[] = 'forms';
        if ($has_plugin('wp-job-manager')) $modules[] = 'jobs';
        if ($has_plugin('ameliabooking')) $modules[] = 'booking';
        if ($has_plugin('fluent-smtp') || $has_plugin('wp-mail-smtp')) $modules[] = 'mail';
        if ($has_plugin('wordpress-seo') || $has_plugin('rank-math')) $modules[] = 'seo';

        return [
            'site_id'        => $this->get_site_id(),
            'site_url'       => get_site_url(),
            'home_url'       => get_home_url(),
            'site_name'      => get_bloginfo('name'),
            'description'    => get_bloginfo('description'),
            'wp_version'     => get_bloginfo('version'),
            'php_version'    => phpversion(),
            'theme'          => get_stylesheet(),
            'locale'         => get_locale(),
            'timezone'       => wp_timezone_string(),
            'multisite'      => is_multisite(),
            'is_staging'     => tinyeclipse_is_staging(),
            'environment'    => tinyeclipse_is_staging() ? 'staging' : 'production',
            'modules'        => $modules,
            'plugin_count'   => count($active_plugins),
            'plugins'        => array_map(function ($p) { return explode('/', $p)[0]; }, $active_plugins),
            'woocommerce'    => class_exists('WooCommerce'),
            'woo_version'    => defined('WC_VERSION') ? WC_VERSION : null,
            'connector_version' => TINYECLIPSE_VERSION,
            'tinyeclipse_wc' => class_exists('TinyEclipse_WC') || defined('TINYECLIPSE_WC_VERSION'),
            'tinyeclipse_analytics' => defined('TINYECLIPSE_ANALYTICS_VERSION'),
            'admin_email'    => get_option('admin_email'),
            'user_count'     => count_users()['total_users'] ?? 0,
            'post_count'     => wp_count_posts('page')->publish + wp_count_posts('post')->publish,
        ];
    }

    /**
     * Onboard this site with the Hub.
     */
    public function onboard($data = []) {
        $site_id = $this->get_site_id();
        if (empty($site_id)) return ['error' => 'No site ID configured'];

        $payload = array_merge($this->get_fingerprint(), $data);

        $response = wp_remote_post(TINYECLIPSE_API_BASE . '/api/sites/' . $site_id . '/onboard', [
            'timeout' => 15,
            'headers' => ['Content-Type' => 'application/json', 'X-Tenant-Id' => $site_id],
            'body'    => wp_json_encode($payload),
        ]);

        if (is_wp_error($response)) return ['error' => $response->get_error_message()];
        return json_decode(wp_remote_retrieve_body($response), true) ?: [];
    }

    /**
     * Send heartbeat to Hub (max once per hour).
     */
    public function maybe_heartbeat() {
        $last = get_transient('tinyeclipse_last_heartbeat');
        if ($last) return;

        $site_id = $this->get_site_id();
        if (empty($site_id)) return;

        set_transient('tinyeclipse_last_heartbeat', time(), HOUR_IN_SECONDS);

        $health_modules = apply_filters('tinyeclipse_health_modules', $this->get_core_health());

        wp_remote_post(TINYECLIPSE_API_BASE . '/api/module-events/' . $site_id, [
            'timeout'  => 5,
            'blocking' => false,
            'headers'  => ['Content-Type' => 'application/json'],
            'body'     => wp_json_encode([
                'module_type' => 'core',
                'event_type'  => 'heartbeat',
                'title'       => 'Heartbeat',
                'data'        => [
                    'version'     => TINYECLIPSE_VERSION,
                    'environment' => tinyeclipse_is_staging() ? 'staging' : 'production',
                    'site_url'    => get_site_url(),
                    'modules'     => $health_modules,
                    'uptime'      => true,
                ],
            ]),
        ]);
    }

    /**
     * Get core health status for all built-in modules.
     */
    private function get_core_health() {
        $modules = [
            'core' => [
                'available' => true,
                'version'   => TINYECLIPSE_VERSION,
                'status'    => 'healthy',
            ],
        ];

        if (class_exists('TinyEclipse_Security')) {
            $modules['security'] = ['available' => true, 'status' => 'healthy'];
        }
        if (class_exists('TinyEclipse_SEO')) {
            $modules['seo'] = ['available' => true, 'status' => 'healthy'];
        }
        if (class_exists('TinyEclipse_Mail')) {
            $modules['mail'] = ['available' => true, 'status' => 'healthy'];
        }
        if (class_exists('TinyEclipse_Translation')) {
            $modules['translation'] = ['available' => function_exists('icl_get_languages'), 'status' => function_exists('icl_get_languages') ? 'healthy' : 'inactive'];
        }
        if (class_exists('TinyEclipse_Jobs')) {
            $modules['jobs'] = ['available' => post_type_exists('job_listing'), 'status' => post_type_exists('job_listing') ? 'healthy' : 'inactive'];
        }
        if (class_exists('TinyEclipse_Forms')) {
            $modules['forms'] = ['available' => function_exists('wpFluent') || class_exists('WPCF7'), 'status' => 'healthy'];
        }
        if (class_exists('TinyEclipse_Tokens')) {
            $modules['tokens'] = ['available' => true, 'status' => 'healthy'];
        }

        return $modules;
    }

    /**
     * Poll Hub for pending commands.
     */
    public function poll_commands() {
        $site_id = $this->get_site_id();
        $hub_key = $this->get_hub_api_key();
        if (empty($site_id) || empty($hub_key)) return;

        $response = wp_remote_get(TINYECLIPSE_API_BASE . '/api/sites/' . $site_id . '/commands', [
            'timeout' => 10,
            'headers' => ['Authorization' => 'Bearer ' . $hub_key, 'X-Tenant-Id' => $site_id],
        ]);

        if (is_wp_error($response)) return;
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (empty($body['commands'])) return;

        $allowed = apply_filters('tinyeclipse_allowed_commands', [
            'scan', 'report', 'sync', 'heartbeat', 'flush_cache', 'update_config',
        ]);

        foreach ($body['commands'] as $cmd) {
            $action = $cmd['action'] ?? '';
            if (!in_array($action, $allowed)) continue;

            switch ($action) {
                case 'scan':
                    if (class_exists('TinyEclipse_Collector')) TinyEclipse_Collector::instance()->run_hourly_scan();
                    break;
                case 'report':
                    if (class_exists('TinyEclipse_Collector')) TinyEclipse_Collector::instance()->run_daily_report();
                    break;
                case 'heartbeat':
                    delete_transient('tinyeclipse_last_heartbeat');
                    $this->maybe_heartbeat();
                    break;
                case 'flush_cache':
                    if (function_exists('wp_cache_flush')) wp_cache_flush();
                    break;
                case 'update_config':
                    if (!empty($cmd['data'])) {
                        foreach ($cmd['data'] as $key => $val) {
                            if (strpos($key, 'tinyeclipse_') === 0) {
                                update_option($key, $val);
                            }
                        }
                    }
                    break;
            }

            tinyeclipse_log('hub', 'info', "Executed command: {$action}", $cmd);
        }
    }

    /**
     * Domain pivot — update site URL in Hub when domain changes.
     */
    public function pivot($new_domain) {
        $site_id = $this->get_site_id();
        if (empty($site_id)) return false;

        $response = wp_remote_post(TINYECLIPSE_API_BASE . '/api/sites/' . $site_id . '/pivot', [
            'timeout' => 10,
            'headers' => ['Content-Type' => 'application/json', 'X-Tenant-Id' => $site_id],
            'body'    => wp_json_encode(['new_domain' => $new_domain, 'old_domain' => get_site_url()]),
        ]);

        return !is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200;
    }
}
