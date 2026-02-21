<?php
/**
 * TinyEclipse Mail Module
 * Mail/SMTP audit: provider detection, configuration check, deliverability status.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_Mail {
    private static $instance = null;

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {}

    /**
     * Run mail/SMTP audit.
     */
    public function audit() {
        $checks = [];
        $active_plugins = get_option('active_plugins', []);

        // 1. SMTP plugin detection
        $smtp_plugins = [
            'wp-mail-smtp/wp_mail_smtp.php' => 'WP Mail SMTP',
            'fluent-smtp/fluent-smtp.php'   => 'FluentSMTP',
            'post-smtp/postman-smtp.php'    => 'Post SMTP',
            'easy-wp-smtp/easy-wp-smtp.php' => 'Easy WP SMTP',
        ];

        $active_smtp = null;
        foreach ($smtp_plugins as $file => $name) {
            if (in_array($file, $active_plugins)) {
                $active_smtp = $name;
                break;
            }
        }

        $checks['smtp_plugin'] = [
            'label'  => 'SMTP Plugin',
            'status' => $active_smtp ? 'pass' : 'fail',
            'detail' => $active_smtp ?: 'No SMTP plugin — using PHP mail() (unreliable)',
            'fix'    => !$active_smtp ? 'Install FluentSMTP or WP Mail SMTP for reliable email delivery' : null,
        ];

        // 2. SMTP configuration
        $smtp_config = $this->get_smtp_config($active_smtp);
        $checks['smtp_config'] = [
            'label'  => 'SMTP Configuration',
            'status' => !empty($smtp_config) ? 'pass' : ($active_smtp ? 'warn' : 'fail'),
            'detail' => !empty($smtp_config) ? count($smtp_config) . ' connection(s) configured' : 'No SMTP connections found',
            'connections' => $smtp_config,
        ];

        // 3. From email - Use configured SMTP sender, not admin email
        $from_email = null;
        $from_name = null;
        
        if (!empty($smtp_config)) {
            // Use the first SMTP connection's sender info
            $first_connection = reset($smtp_config);
            $from_email = $first_connection['from_email'] ?? null;
            $from_name = $first_connection['from_name'] ?? null;
        }
        
        // Fallback to admin email only if no SMTP config
        if (empty($from_email)) {
            $admin_email = get_option('admin_email', '');
            $from_email = $admin_email;
            if (class_exists('WooCommerce')) {
                $from_email = get_option('woocommerce_email_from_address', $admin_email);
            }
        }
        
        $checks['from_email'] = [
            'label'  => 'From Email',
            'status' => !empty($from_email) && strpos($from_email, '@') !== false ? 'pass' : 'warn',
            'detail' => $from_email ?: '(not set)',
            'from_name' => $from_name,
            'is_smtp_configured' => !empty($smtp_config)
        ];

        // 4. SPF/DKIM (basic check via domain)
        $domain = parse_url(get_site_url(), PHP_URL_HOST);
        $checks['email_domain'] = [
            'label'  => 'Email Domain',
            'status' => 'info',
            'detail' => "Domain: {$domain} — SPF/DKIM/DMARC should be configured at DNS level",
        ];

        // Calculate score
        $total = count(array_filter($checks, function ($c) { return $c['status'] !== 'info'; }));
        $passed = count(array_filter($checks, function ($c) { return $c['status'] === 'pass'; }));
        $score = $total > 0 ? round(($passed / $total) * 100) : 0;

        return [
            'score'       => $score,
            'smtp_active' => !empty($active_smtp),
            'smtp_plugin' => $active_smtp,
            'admin_email' => get_option('admin_email', ''),
            'from_email'  => $from_email,
            'from_name'   => $from_name,
            'checks'      => $checks,
            'scanned_at'  => current_time('c'),
        ];
    }

    /**
     * Get SMTP connection configuration.
     */
    private function get_smtp_config($plugin_name) {
        $config = [];

        if ($plugin_name === 'FluentSMTP') {
            $settings = get_option('fluentmail-settings', []);
            if (!empty($settings['connections'])) {
                foreach ($settings['connections'] as $key => $conn) {
                    $config[] = [
                        'sender'     => $key,
                        'provider'   => $conn['provider_settings']['provider'] ?? 'unknown',
                        'from_email' => $conn['provider_settings']['sender_email'] ?? '',
                        'from_name'  => $conn['provider_settings']['sender_name'] ?? '',
                    ];
                }
            }
        } elseif ($plugin_name === 'WP Mail SMTP') {
            $wp_mail_smtp = get_option('wp_mail_smtp', []);
            if (!empty($wp_mail_smtp['mail'])) {
                $config[] = [
                    'sender'     => 'primary',
                    'provider'   => $wp_mail_smtp['mail']['mailer'] ?? 'unknown',
                    'from_email' => $wp_mail_smtp['mail']['from_email'] ?? '',
                    'from_name'  => $wp_mail_smtp['mail']['from_name'] ?? '',
                ];
            }
        }

        return $config;
    }

    /**
     * Get full mail status for REST API.
     */
    public function get_status() {
        $audit = $this->audit();
        return [
            'smtp_active'      => $audit['smtp_active'],
            'smtp_plugin'      => $audit['smtp_plugin'],
            'smtp_connections' => $audit['checks']['smtp_config']['connections'] ?? [],
            'admin_email'      => $audit['admin_email'],
            'from_email'       => $audit['from_email'],
            'from_name'        => $audit['from_name'] ?? null,
            'is_smtp_configured' => $audit['checks']['from_email']['is_smtp_configured'] ?? false,
            'site_name'        => get_bloginfo('name'),
            'score'            => $audit['score'],
        ];
    }
}
