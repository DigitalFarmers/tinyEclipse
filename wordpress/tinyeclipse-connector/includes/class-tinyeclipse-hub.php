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

        // Mother Brain: Auto-update from Hub
        add_filter('pre_set_site_transient_update_plugins', [$this, 'check_for_update']);
        add_filter('plugins_api', [$this, 'plugin_info'], 20, 3);
        add_filter('upgrader_post_install', [$this, 'after_plugin_install'], 10, 3);
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
            'wpml_active'    => function_exists('icl_get_languages'),
            'content_units'  => $this->get_wpml_aware_counts(),
        ];
    }

    /**
     * Get WPML-aware content counts.
     * Returns real unique content units vs inflated WP post counts.
     */
    private function get_wpml_aware_counts() {
        $wp_pages = (int)wp_count_posts('page')->publish;
        $wp_posts = (int)wp_count_posts('post')->publish;
        $wp_products = class_exists('WooCommerce') ? (int)wp_count_posts('product')->publish : 0;
        $wp_total = $wp_pages + $wp_posts;

        if (!function_exists('icl_get_languages')) {
            return [
                'wpml_grouped'    => false,
                'unique_pages'    => $wp_pages,
                'unique_posts'    => $wp_posts,
                'unique_products' => $wp_products,
                'unique_total'    => $wp_total,
                'wp_total'        => $wp_total,
                'language_count'  => 1,
                'inflation_factor'=> 1.0,
            ];
        }

        $langs = icl_get_languages('skip_missing=0');
        $lang_count = count($langs);
        $default_lang = apply_filters('wpml_default_language', null);

        // Count only default-language content
        do_action('wpml_switch_language', $default_lang);
        $unique_pages = count(get_posts(['post_type' => 'page', 'post_status' => 'publish', 'numberposts' => 500, 'suppress_filters' => false]));
        $unique_posts = count(get_posts(['post_type' => 'post', 'post_status' => 'publish', 'numberposts' => 500, 'suppress_filters' => false]));
        $unique_products = 0;
        if (class_exists('WooCommerce')) {
            $unique_products = count(get_posts(['post_type' => 'product', 'post_status' => 'publish', 'numberposts' => 500, 'suppress_filters' => false]));
        }
        do_action('wpml_switch_language', null);

        $unique_total = $unique_pages + $unique_posts;
        $inflation = $wp_total > 0 && $unique_total > 0 ? round($wp_total / $unique_total, 1) : 1.0;

        return [
            'wpml_grouped'    => true,
            'unique_pages'    => $unique_pages,
            'unique_posts'    => $unique_posts,
            'unique_products' => $unique_products,
            'unique_total'    => $unique_total,
            'wp_total'        => $wp_total,
            'language_count'  => $lang_count,
            'default_language'=> $default_lang,
            'inflation_factor'=> $inflation,
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

    /**
     * Detect the complete WordPress ecosystem - intelligent plugin detection
     */
    public function detect_ecosystem() {
        $site_id = $this->get_site_id();
        if (empty($site_id)) return [];

        // Get base fingerprint
        $fingerprint = $this->get_fingerprint();
        
        // Enhanced ecosystem detection
        $ecosystem = [
            'site_id' => $site_id,
            'scan_timestamp' => current_time('mysql'),
            'wordpress' => [
                'version' => $fingerprint['wp_version'],
                'php_version' => $fingerprint['php_version'],
                'environment' => $fingerprint['environment'],
                'multisite' => $fingerprint['multisite'],
                'locale' => $fingerprint['locale'],
                'timezone' => $fingerprint['timezone']
            ],
            'plugins' => $this->detect_plugins_detailed(),
            'themes' => $this->detect_theme_capabilities(),
            'capabilities' => $this->get_ecosystem_capabilities(),
            'endpoints' => $this->detect_available_endpoints(),
            'integrations' => $this->detect_integrations(),
            'confidence_score' => 0,
            'learning_data' => []
        ];

        // Calculate confidence score
        $ecosystem['confidence_score'] = $this->calculate_detection_confidence($ecosystem);

        // Store in tenant settings (no new database!)
        $this->store_ecosystem_data($ecosystem);

        // Send to Hub for learning
        $this->send_ecosystem_to_hub($ecosystem);

        return $ecosystem;
    }

    /**
     * Detailed plugin detection with versions and capabilities
     */
    private function detect_plugins_detailed() {
        $active_plugins = get_option('active_plugins', []);
        $all_plugins = get_plugins();
        $detected = [];

        foreach ($active_plugins as $plugin_path) {
            $plugin_data = $all_plugins[$plugin_path] ?? [];
            $plugin_slug = explode('/', $plugin_path)[0];
            
            $detected[$plugin_slug] = [
                'name' => $plugin_data['Name'] ?? $plugin_slug,
                'version' => $plugin_data['Version'] ?? 'unknown',
                'author' => $plugin_data['Author'] ?? 'unknown',
                'path' => $plugin_path,
                'type' => $this->classify_plugin_type($plugin_slug, $plugin_data),
                'capabilities' => $this->get_plugin_capabilities($plugin_slug),
                'endpoints' => $this->detect_plugin_endpoints($plugin_slug),
                'hooks' => $this->detect_plugin_hooks($plugin_slug),
                'confidence' => $this->calculate_plugin_confidence($plugin_slug, $plugin_data)
            ];
        }

        return $detected;
    }

    /**
     * Classify plugin type for intelligent routing
     */
    private function classify_plugin_type($slug, $data) {
        $name = strtolower($data['Name'] ?? '');
        $slug_lower = strtolower($slug);

        // Form plugins
        if (strpos($slug_lower, 'fluentform') !== false || strpos($name, 'fluent form') !== false) return 'forms';
        if (strpos($slug_lower, 'contact-form-7') !== false || strpos($name, 'contact form 7') !== false) return 'forms';
        if (strpos($slug_lower, 'gravityforms') !== false || strpos($name, 'gravity') !== false) return 'forms';

        // E-commerce
        if (strpos($slug_lower, 'woocommerce') !== false || strpos($name, 'woocommerce') !== false) return 'shop';
        if (strpos($slug_lower, 'easy-digital-downloads') !== false) return 'shop';

        // CRM
        if (strpos($slug_lower, 'fluentcrm') !== false || strpos($name, 'fluent crm') !== false) return 'crm';
        if (strpos($slug_lower, 'hubspot') !== false) return 'crm';

        // Booking/Calendar
        if (strpos($slug_lower, 'fluent-booking') !== false || strpos($name, 'fluent booking') !== false) return 'booking';
        if (strpos($slug_lower, 'calendly') !== false) return 'booking';

        // SEO
        if (strpos($slug_lower, 'wordpress-seo') !== false || strpos($name, 'yoast') !== false) return 'seo';
        if (strpos($slug_lower, 'rank-math') !== false || strpos($name, 'rank math') !== false) return 'seo';

        // Translation
        if (strpos($slug_lower, 'wpml') !== false || strpos($name, 'wpml') !== false) return 'translation';

        // Security
        if (strpos($slug_lower, 'wordfence') !== false || strpos($name, 'wordfence') !== false) return 'security';
        if (strpos($slug_lower, 'sucuri') !== false) return 'security';

        // Analytics
        if (strpos($slug_lower, 'google-analytics') !== false) return 'analytics';
        if (strpos($slug_lower, 'monsterinsights') !== false) return 'analytics';

        // Performance
        if (strpos($slug_lower, 'wp-rocket') !== false || strpos($name, 'rocket') !== false) return 'performance';
        if (strpos($slug_lower, 'w3-total-cache') !== false) return 'performance';

        return 'other';
    }

    /**
     * Get plugin capabilities based on type and detection
     */
    private function get_plugin_capabilities($slug) {
        $capabilities = [];

        // Form plugins
        if ($slug === 'fluentform' || strpos($slug, 'fluentform') !== false) {
            $capabilities = ['forms', 'submissions', 'notifications', 'analytics', 'conditional_logic'];
        } elseif ($slug === 'contact-form-7') {
            $capabilities = ['forms', 'submissions', 'mail', 'ajax'];
        } elseif ($slug === 'gravityforms') {
            $capabilities = ['forms', 'submissions', 'addons', 'payments', 'conditional_logic'];
        }

        // E-commerce
        if ($slug === 'woocommerce') {
            $capabilities = ['products', 'orders', 'customers', 'payments', 'shipping', 'coupons', 'inventory'];
        }

        // CRM
        if ($slug === 'fluentcrm') {
            $capabilities = ['contacts', 'lists', 'campaigns', 'automation', 'funnels', 'tags'];
        }

        // Booking
        if ($slug === 'fluent-booking') {
            $capabilities = ['bookings', 'calendar', 'payments', 'notifications', 'availability'];
        }

        return $capabilities;
    }

    /**
     * Detect available endpoints for plugins
     */
    private function detect_plugin_endpoints($slug) {
        $endpoints = [];

        // Known REST API endpoints
        if ($slug === 'woocommerce') {
            $endpoints = [
                'products' => '/wc/v3/products',
                'orders' => '/wc/v3/orders',
                'customers' => '/wc/v3/customers',
                'coupons' => '/wc/v3/coupons'
            ];
        } elseif ($slug === 'fluentform') {
            $endpoints = [
                'forms' => '/fluentform/forms',
                'submissions' => '/fluentform/submissions',
                'settings' => '/fluentform/settings'
            ];
        } elseif ($slug === 'fluentcrm') {
            $endpoints = [
                'contacts' => '/fluentcrm/v2/contacts',
                'lists' => '/fluentcrm/v2/lists',
                'campaigns' => '/fluentcrm/v2/campaigns'
            ];
        }

        return $endpoints;
    }

    /**
     * Detect plugin hooks and filters
     */
    private function detect_plugin_hooks($slug) {
        global $wp_filter;
        $hooks = [];

        // Look for plugin-specific hooks
        foreach ($wp_filter as $hook_name => $hook_data) {
            if (strpos($hook_name, strtolower($slug)) !== false) {
                $hooks[] = $hook_name;
            }
        }

        // Known important hooks by plugin
        if ($slug === 'fluentform') {
            $hooks = array_merge($hooks, ['fluentform_before_insert', 'fluentform_after_submission', 'fluentform_validation_errors']);
        } elseif ($slug === 'woocommerce') {
            $hooks = array_merge($hooks, ['woocommerce_new_order', 'woocommerce_order_status_changed', 'woocommerce_payment_complete']);
        } elseif ($slug === 'fluentcrm') {
            $hooks = array_merge($hooks, ['fluentcrm_contact_created', 'fluentcrm_contact_updated', 'fluentcrm_campaign_sent']);
        }

        return $hooks;
    }

    /**
     * Calculate confidence score for plugin detection
     */
    private function calculate_plugin_confidence($slug, $data) {
        $confidence = 0.5; // Base confidence

        // Boost confidence for well-known plugins
        $known_plugins = ['woocommerce', 'fluentform', 'contact-form-7', 'gravityforms', 'fluentcrm', 'wordpress-seo', 'wpml'];
        if (in_array($slug, $known_plugins)) {
            $confidence += 0.3;
        }

        // Boost if we have good data
        if (!empty($data['Version']) && $data['Version'] !== 'unknown') {
            $confidence += 0.1;
        }

        if (!empty($data['Author']) && $data['Author'] !== 'unknown') {
            $confidence += 0.1;
        }

        return min($confidence, 1.0);
    }

    /**
     * Detect theme capabilities
     */
    private function detect_theme_capabilities() {
        $theme = wp_get_theme();
        return [
            'name' => $theme->get('Name'),
            'version' => $theme->get('Version'),
            'author' => $theme->get('Author'),
            'supports' => $theme->get('Theme Support'),
            'features' => $this->get_theme_features(),
            'customizer_options' => $this->detect_customizer_options()
        ];
    }

    /**
     * Get theme features
     */
    private function get_theme_features() {
        $features = [];
        $theme_features = [
            'post-thumbnails', 'post-formats', 'custom-header', 'custom-background',
            'automatic-feed-links', 'menus', 'widgets', 'html5', 'title-tag',
            'customize-selective-refresh-widgets', 'starter-content'
        ];

        foreach ($theme_features as $feature) {
            if (current_theme_supports($feature)) {
                $features[] = $feature;
            }
        }

        return $features;
    }

    /**
     * Detect customizer options
     */
    private function detect_customizer_options() {
        // This would scan for available customizer sections and options
        return [
            'logo' => current_theme_supports('custom-logo'),
            'header_image' => current_theme_supports('custom-header'),
            'background' => current_theme_supports('custom-background'),
            'colors' => current_theme_supports('custom-colors'),
            'fonts' => current_theme_supports('custom-fonts')
        ];
    }

    /**
     * Get overall ecosystem capabilities
     */
    private function get_ecosystem_capabilities() {
        $capabilities = [];

        // Core WordPress capabilities
        $capabilities['wordpress'] = [
            'posts' => true,
            'pages' => true,
            'media' => true,
            'users' => true,
            'comments' => true,
            'menus' => true,
            'widgets' => true,
            'themes' => true,
            'plugins' => true
        ];

        // Plugin capabilities
        $plugins = $this->detect_plugins_detailed();
        foreach ($plugins as $slug => $plugin) {
            $capabilities[$plugin['type']][] = $slug;
        }

        // Theme capabilities
        $capabilities['theme'] = $this->detect_theme_capabilities();

        return $capabilities;
    }

    /**
     * Detect all available endpoints
     */
    private function detect_available_endpoints() {
        $endpoints = [];

        // WordPress REST API
        $endpoints['wordpress'] = [
            'posts' => '/wp/v2/posts',
            'pages' => '/wp/v2/pages',
            'media' => '/wp/v2/media',
            'users' => '/wp/v2/users',
            'categories' => '/wp/v2/categories',
            'tags' => '/wp/v2/tags'
        ];

        // Plugin endpoints
        $plugins = $this->detect_plugins_detailed();
        foreach ($plugins as $slug => $plugin) {
            if (!empty($plugin['endpoints'])) {
                $endpoints[$slug] = $plugin['endpoints'];
            }
        }

        return $endpoints;
    }

    /**
     * Detect integrations with external services
     */
    private function detect_integrations() {
        $integrations = [];

        // Check for common integrations
        if (get_option('google_maps_api_key')) {
            $integrations['google_maps'] = ['status' => 'connected', 'api_key' => true];
        }

        if (get_option('mailchimp_api_key')) {
            $integrations['mailchimp'] = ['status' => 'connected', 'api_key' => true];
        }

        if (get_option('stripe_api_key') || get_option('woocommerce_stripe_settings')) {
            $integrations['stripe'] = ['status' => 'connected'];
        }

        if (get_option('paypal_live_api_username') || get_option('woocommerce_paypal_settings')) {
            $integrations['paypal'] = ['status' => 'connected'];
        }

        return $integrations;
    }

    /**
     * Calculate overall detection confidence
     */
    private function calculate_detection_confidence($ecosystem) {
        $total_confidence = 0;
        $count = 0;

        // Plugin confidence
        if (!empty($ecosystem['plugins'])) {
            foreach ($ecosystem['plugins'] as $plugin) {
                $total_confidence += $plugin['confidence'];
                $count++;
            }
        }

        return $count > 0 ? ($total_confidence / $count) : 0;
    }

    /**
     * Store ecosystem data in tenant settings (no new database!)
     */
    private function store_ecosystem_data($ecosystem) {
        $site_id = $this->get_site_id();
        if (empty($site_id)) return;

        // Store in WordPress options (will be synced to Hub)
        update_option('tinyeclipse_ecosystem_data', $ecosystem);
        update_option('tinyeclipse_ecosystem_last_scan', current_time('mysql'));
    }

    /**
     * Send ecosystem data to Hub for learning
     */
    private function send_ecosystem_to_hub($ecosystem) {
        $site_id = $this->get_site_id();
        if (empty($site_id)) return;

        wp_remote_post(TINYECLIPSE_API_BASE . '/api/ecosystem/scan/' . $site_id, [
            'timeout' => 30,
            'headers' => [
                'Content-Type' => 'application/json',
                'X-Tenant-Id' => $site_id,
                'Authorization' => 'Bearer ' . $this->get_hub_api_key()
            ],
            'body' => wp_json_encode($ecosystem)
        ]);
    }

    /**
     * Get plugin capabilities for routing
     */
    public function get_plugin_capabilities($plugin_type) {
        $ecosystem_data = get_option('tinyeclipse_ecosystem_data', []);
        
        if (empty($ecosystem_data['plugins'])) {
            return [];
        }

        $capabilities = [];
        foreach ($ecosystem_data['plugins'] as $slug => $plugin) {
            if ($plugin['type'] === $plugin_type) {
                $capabilities[$slug] = $plugin['capabilities'];
            }
        }

        return $capabilities;
    }

    /**
     * Adapt to specific plugin with action
     */
    public function adapt_to_plugin($plugin_type, $action, $data = []) {
        $ecosystem_data = get_option('tinyeclipse_ecosystem_data', []);
        
        if (empty($ecosystem_data['plugins'])) {
            return ['error' => 'No ecosystem data available'];
        }

        // Find plugin handler
        foreach ($ecosystem_data['plugins'] as $slug => $plugin) {
            if ($plugin['type'] === $plugin_type) {
                return $this->execute_plugin_action($slug, $action, $data, $plugin);
            }
        }

        return ['error' => 'No plugin found for type: ' . $plugin_type];
    }

    /**
     * Execute action on specific plugin
     */
    private function execute_plugin_action($slug, $action, $data, $plugin_info) {
        switch ($action) {
            case 'get_forms':
                if ($plugin_info['type'] === 'forms') {
                    return $this->get_forms_from_plugin($slug, $plugin_info);
                }
                break;

            case 'get_products':
                if ($plugin_info['type'] === 'shop') {
                    return $this->get_products_from_plugin($slug, $plugin_info);
                }
                break;

            case 'get_contacts':
                if ($plugin_info['type'] === 'crm') {
                    return $this->get_contacts_from_plugin($slug, $plugin_info);
                }
                break;

            case 'get_bookings':
                if ($plugin_info['type'] === 'booking') {
                    return $this->get_bookings_from_plugin($slug, $plugin_info);
                }
                break;
        }

        return ['error' => 'Action not supported for plugin: ' . $slug];
    }

    /**
     * Get forms from plugin
     */
    private function get_forms_from_plugin($slug, $plugin_info) {
        if ($slug === 'fluentform' && function_exists('wpFluent')) {
            $forms = wpFluent('forms')->get();
            return ['forms' => $forms, 'source' => 'fluentform'];
        } elseif ($slug === 'contact-form-7' && class_exists('WPCF7_ContactForm')) {
            $forms = get_posts(['post_type' => 'wpcf7_contact_form', 'numberposts' => -1]);
            return ['forms' => $forms, 'source' => 'contact-form-7'];
        }

        return ['forms' => [], 'source' => $slug];
    }

    /**
     * Get products from plugin
     */
    private function get_products_from_plugin($slug, $plugin_info) {
        if ($slug === 'woocommerce' && class_exists('WC_Product')) {
            $products = wc_get_products(['limit' => -1]);
            return ['products' => $products, 'source' => 'woocommerce'];
        }

        return ['products' => [], 'source' => $slug];
    }

    /**
     * Get contacts from plugin
     */
    private function get_contacts_from_plugin($slug, $plugin_info) {
        if ($slug === 'fluentcrm' && class_exists('FluentCrmApi')) {
            $contacts = FluentCrmApi('contacts')->get();
            return ['contacts' => $contacts, 'source' => 'fluentcrm'];
        }

        return ['contacts' => [], 'source' => $slug];
    }

    /**
     * Get bookings from plugin
     */
    private function get_bookings_from_plugin($slug, $plugin_info) {
        // Implementation for booking plugins
        return ['bookings' => [], 'source' => $slug];
    }

    // ═══════════════════════════════════════════════════════════════
    // MOTHER BRAIN: AUTO-UPDATE FROM HUB
    // ═══════════════════════════════════════════════════════════════

    /**
     * Check Hub for plugin updates — hooks into WordPress update system.
     */
    public function check_for_update($transient) {
        if (empty($transient->checked)) return $transient;

        $remote = $this->get_remote_version();
        if (!$remote || empty($remote['version'])) return $transient;

        $plugin_slug = 'tinyeclipse-connector/tinyeclipse-connector.php';

        if (version_compare(TINYECLIPSE_VERSION, $remote['version'], '<')) {
            $res = new \stdClass();
            $res->slug        = 'tinyeclipse-connector';
            $res->plugin      = $plugin_slug;
            $res->new_version  = $remote['version'];
            $res->tested       = $remote['tested'] ?? '6.7';
            $res->package      = $remote['download_url'] ?? '';
            $res->url          = $remote['info_url'] ?? 'https://tinyeclipse.digitalfarmers.be';
            $res->icons        = $remote['icons'] ?? [];
            $res->banners      = [];
            $res->requires_php = $remote['requires_php'] ?? '7.4';

            $transient->response[$plugin_slug] = $res;
        }

        return $transient;
    }

    /**
     * Provide plugin info for WP's "View Details" modal.
     */
    public function plugin_info($result, $action, $args) {
        if ($action !== 'plugin_information') return $result;
        if (!isset($args->slug) || $args->slug !== 'tinyeclipse-connector') return $result;

        $remote = $this->get_remote_version();
        if (!$remote) return $result;

        $info = new \stdClass();
        $info->name          = 'TinyEclipse Connector';
        $info->slug          = 'tinyeclipse-connector';
        $info->version       = $remote['version'] ?? TINYECLIPSE_VERSION;
        $info->author        = '<a href="https://digitalfarmers.be">Digital Farmers</a>';
        $info->homepage      = 'https://tinyeclipse.digitalfarmers.be';
        $info->requires      = '5.8';
        $info->tested        = $remote['tested'] ?? '6.7';
        $info->requires_php  = $remote['requires_php'] ?? '7.4';
        $info->download_link = $remote['download_url'] ?? '';
        $info->trunk         = $remote['download_url'] ?? '';
        $info->last_updated  = $remote['released'] ?? '';
        $info->sections      = [
            'description'  => $remote['description'] ?? 'TinyEclipse AI assistant connector — powered by the Mother Brain cloud.',
            'changelog'    => $remote['changelog'] ?? 'See the TinyEclipse Hub for the latest changelog.',
        ];

        return $info;
    }

    /**
     * After plugin install, ensure folder name stays correct.
     */
    public function after_plugin_install($response, $hook_extra, $result) {
        if (!isset($hook_extra['plugin']) || $hook_extra['plugin'] !== 'tinyeclipse-connector/tinyeclipse-connector.php') {
            return $response;
        }

        global $wp_filesystem;
        $proper_destination = WP_PLUGIN_DIR . '/tinyeclipse-connector';
        $install_destination = $result['destination'] ?? '';

        if ($install_destination && $install_destination !== $proper_destination) {
            $wp_filesystem->move($install_destination, $proper_destination);
            $result['destination'] = $proper_destination;
        }

        activate_plugin('tinyeclipse-connector/tinyeclipse-connector.php');
        return $response;
    }

    /**
     * Fetch remote version info from Hub (cached for 6 hours).
     */
    private function get_remote_version() {
        $cache_key = 'tinyeclipse_remote_version';
        $cached = get_transient($cache_key);
        if ($cached !== false) return $cached;

        $response = wp_remote_get(TINYECLIPSE_API_BASE . '/api/sites/plugin-version', [
            'timeout' => 10,
            'headers' => ['Accept' => 'application/json'],
        ]);

        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
            // Cache failure for 1 hour to avoid hammering
            set_transient($cache_key, [], HOUR_IN_SECONDS);
            return [];
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (empty($body) || empty($body['version'])) {
            set_transient($cache_key, [], HOUR_IN_SECONDS);
            return [];
        }

        set_transient($cache_key, $body, 6 * HOUR_IN_SECONDS);
        return $body;
    }
}
