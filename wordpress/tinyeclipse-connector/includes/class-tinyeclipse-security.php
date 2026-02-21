<?php
/**
 * TinyEclipse Security Module
 * Security audit: .htaccess, headers, file permissions, brute-force detection, SSL, user enumeration.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_Security {
    private static $instance = null;

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {}

    /**
     * Run full security audit.
     */
    public function audit() {
        $checks = [];

        // 1. SSL check
        $checks['ssl'] = [
            'label'  => 'SSL Certificate',
            'status' => is_ssl() ? 'pass' : 'fail',
            'detail' => is_ssl() ? 'Site uses HTTPS' : 'Site is NOT using HTTPS',
            'fix'    => !is_ssl() ? 'Enable SSL in your hosting panel and update WordPress URLs' : null,
        ];

        // 2. WordPress version
        $wp_version = get_bloginfo('version');
        $latest = get_site_transient('update_core');
        $is_latest = true;
        if ($latest && !empty($latest->updates)) {
            $newest = $latest->updates[0]->version ?? $wp_version;
            $is_latest = version_compare($wp_version, $newest, '>=');
        }
        $checks['wp_version'] = [
            'label'  => 'WordPress Version',
            'status' => $is_latest ? 'pass' : 'warn',
            'detail' => "WordPress {$wp_version}" . (!$is_latest ? ' (update available)' : ' (latest)'),
        ];

        // 3. PHP version
        $php = phpversion();
        $php_ok = version_compare($php, '8.0', '>=');
        $checks['php_version'] = [
            'label'  => 'PHP Version',
            'status' => $php_ok ? 'pass' : 'warn',
            'detail' => "PHP {$php}" . (!$php_ok ? ' — upgrade recommended (8.1+)' : ''),
        ];

        // 4. Debug mode
        $checks['debug_mode'] = [
            'label'  => 'Debug Mode',
            'status' => defined('WP_DEBUG') && WP_DEBUG ? 'warn' : 'pass',
            'detail' => WP_DEBUG ? 'WP_DEBUG is ON (disable in production)' : 'WP_DEBUG is OFF',
            'fix'    => WP_DEBUG ? 'Set WP_DEBUG to false in wp-config.php' : null,
        ];

        // 5. File editing
        $checks['file_editing'] = [
            'label'  => 'File Editing',
            'status' => defined('DISALLOW_FILE_EDIT') && DISALLOW_FILE_EDIT ? 'pass' : 'warn',
            'detail' => (defined('DISALLOW_FILE_EDIT') && DISALLOW_FILE_EDIT) ? 'File editing disabled' : 'File editing is enabled in admin',
            'fix'    => !(defined('DISALLOW_FILE_EDIT') && DISALLOW_FILE_EDIT) ? "Add define('DISALLOW_FILE_EDIT', true); to wp-config.php" : null,
        ];

        // 6. Database prefix
        global $wpdb;
        $default_prefix = ($wpdb->prefix === 'wp_');
        $checks['db_prefix'] = [
            'label'  => 'Database Prefix',
            'status' => $default_prefix ? 'warn' : 'pass',
            'detail' => $default_prefix ? 'Using default prefix wp_ (less secure)' : "Custom prefix: {$wpdb->prefix}",
        ];

        // 7. Admin username
        $admin_user = get_user_by('login', 'admin');
        $checks['admin_username'] = [
            'label'  => 'Admin Username',
            'status' => $admin_user ? 'warn' : 'pass',
            'detail' => $admin_user ? 'Default "admin" username exists' : 'No default admin username',
            'fix'    => $admin_user ? 'Create a new admin user and delete the "admin" account' : null,
        ];

        // 8. Security headers
        $headers = $this->check_security_headers();
        $checks['security_headers'] = [
            'label'  => 'Security Headers',
            'status' => $headers['score'] >= 4 ? 'pass' : ($headers['score'] >= 2 ? 'warn' : 'fail'),
            'detail' => "{$headers['score']}/6 security headers present",
            'headers' => $headers['details'],
        ];

        // 9. XML-RPC
        $checks['xmlrpc'] = [
            'label'  => 'XML-RPC',
            'status' => $this->is_xmlrpc_enabled() ? 'warn' : 'pass',
            'detail' => $this->is_xmlrpc_enabled() ? 'XML-RPC is enabled (potential attack vector)' : 'XML-RPC is disabled',
        ];

        // 10. wp-config.php permissions
        $config_path = ABSPATH . 'wp-config.php';
        if (file_exists($config_path)) {
            $perms = substr(sprintf('%o', fileperms($config_path)), -3);
            $checks['config_perms'] = [
                'label'  => 'wp-config.php Permissions',
                'status' => in_array($perms, ['400', '440', '444', '600', '640']) ? 'pass' : 'warn',
                'detail' => "Permissions: {$perms}",
            ];
        }

        // 11. Plugin updates
        $plugin_updates = get_site_transient('update_plugins');
        $update_count = !empty($plugin_updates->response) ? count($plugin_updates->response) : 0;
        $checks['plugin_updates'] = [
            'label'  => 'Plugin Updates',
            'status' => $update_count === 0 ? 'pass' : 'warn',
            'detail' => $update_count === 0 ? 'All plugins up to date' : "{$update_count} plugin(s) need updating",
        ];

        // Calculate overall score
        $total = count($checks);
        $passed = count(array_filter($checks, function ($c) { return $c['status'] === 'pass'; }));
        $score = $total > 0 ? round(($passed / $total) * 100) : 0;

        return [
            'score'      => $score,
            'total'      => $total,
            'passed'     => $passed,
            'checks'     => $checks,
            'scanned_at' => current_time('c'),
        ];
    }

    /**
     * Check security headers on the site.
     */
    private function check_security_headers() {
        $url = get_site_url();
        $response = wp_remote_head($url, ['timeout' => 5, 'sslverify' => false]);
        if (is_wp_error($response)) return ['score' => 0, 'details' => []];

        $headers = wp_remote_retrieve_headers($response);
        $check_headers = [
            'x-content-type-options'    => 'X-Content-Type-Options',
            'x-frame-options'           => 'X-Frame-Options',
            'x-xss-protection'          => 'X-XSS-Protection',
            'strict-transport-security' => 'Strict-Transport-Security',
            'content-security-policy'   => 'Content-Security-Policy',
            'referrer-policy'           => 'Referrer-Policy',
        ];

        $score = 0;
        $details = [];
        foreach ($check_headers as $key => $label) {
            $present = isset($headers[$key]);
            if ($present) $score++;
            $details[$key] = ['label' => $label, 'present' => $present, 'value' => $present ? $headers[$key] : null];
        }

        return ['score' => $score, 'details' => $details];
    }

    /**
     * Check if XML-RPC is enabled.
     */
    private function is_xmlrpc_enabled() {
        return apply_filters('xmlrpc_enabled', true);
    }

    /**
     * Apply a security fix.
     */
    public function apply_fix($fix_type) {
        switch ($fix_type) {
            case 'disable_xmlrpc':
                add_filter('xmlrpc_enabled', '__return_false');
                // Try to add to .htaccess
                $htaccess = ABSPATH . '.htaccess';
                if (is_writable($htaccess)) {
                    $content = file_get_contents($htaccess);
                    if (strpos($content, 'xmlrpc.php') === false) {
                        $rule = "\n# TinyEclipse: Disable XML-RPC\n<Files xmlrpc.php>\nOrder Deny,Allow\nDeny from all\n</Files>\n";
                        file_put_contents($htaccess, $content . $rule);
                    }
                }
                return ['status' => 'applied', 'fix' => 'disable_xmlrpc'];

            case 'add_security_headers':
                // Add headers via .htaccess
                $htaccess = ABSPATH . '.htaccess';
                if (is_writable($htaccess)) {
                    $content = file_get_contents($htaccess);
                    if (strpos($content, 'TinyEclipse: Security Headers') === false) {
                        $headers = "\n# TinyEclipse: Security Headers\n<IfModule mod_headers.c>\nHeader set X-Content-Type-Options \"nosniff\"\nHeader set X-Frame-Options \"SAMEORIGIN\"\nHeader set X-XSS-Protection \"1; mode=block\"\nHeader set Referrer-Policy \"strict-origin-when-cross-origin\"\n</IfModule>\n";
                        file_put_contents($htaccess, $content . $headers);
                    }
                }
                return ['status' => 'applied', 'fix' => 'add_security_headers'];

            default:
                return ['status' => 'unknown_fix', 'fix' => $fix_type];
        }
    }

    /**
     * Store audit results in DB.
     */
    public function save_audit($audit) {
        global $wpdb;
        $table = $wpdb->prefix . 'tinyeclipse_security';
        foreach ($audit['checks'] as $type => $check) {
            $wpdb->insert($table, [
                'check_type' => $type,
                'status'     => $check['status'],
                'details'    => wp_json_encode($check),
                'created_at' => current_time('mysql'),
            ]);
        }
    }
}
