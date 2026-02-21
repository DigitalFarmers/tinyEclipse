<?php
/**
 * TinyEclipse Collector Module
 * Central aggregator: collects data from all modules, generates reports, sends to Hub.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_Collector {
    private static $instance = null;

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {}

    /**
     * Collect all module data into a single payload.
     */
    public function collect_all() {
        $data = [
            'tenant_id'  => tinyeclipse_get_tenant_id(),
            'site_url'   => get_site_url(),
            'synced_at'  => current_time('c'),
            'version'    => TINYECLIPSE_VERSION,
            'environment'=> tinyeclipse_is_staging() ? 'staging' : 'production',
        ];

        // Security
        if (class_exists('TinyEclipse_Security')) {
            $data['security'] = TinyEclipse_Security::instance()->audit();
        }

        // SEO
        if (class_exists('TinyEclipse_SEO')) {
            $data['seo'] = TinyEclipse_SEO::instance()->audit();
        }

        // Mail
        if (class_exists('TinyEclipse_Mail')) {
            $data['mail'] = TinyEclipse_Mail::instance()->get_status();
        }

        // Forms
        $data['form_submissions'] = [];
        if (function_exists('wpFluent')) {
            global $wpdb;
            $subs = $wpdb->get_results("SELECT s.id, s.form_id, s.response, s.status, s.created_at, f.title as form_title
                FROM {$wpdb->prefix}fluentform_submissions s
                LEFT JOIN {$wpdb->prefix}fluentform_forms f ON f.id = s.form_id
                ORDER BY s.id DESC LIMIT 500");
            foreach ($subs as $sub) {
                $fields = json_decode($sub->response, true) ?: [];
                $email = $name = $phone = '';
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

        // Users
        $data['users'] = [];
        $users = get_users(['number' => 200]);
        foreach ($users as $u) {
            $data['users'][] = [
                'user_id' => $u->ID, 'email' => $u->user_email,
                'name' => $u->display_name, 'role' => implode(',', $u->roles),
                'registered' => $u->user_registered,
            ];
        }

        // Comments
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

        // Site metadata
        $active_plugins = get_option('active_plugins', []);
        $data['site_meta'] = [
            'name' => get_bloginfo('name'), 'description' => get_bloginfo('description'),
            'url' => get_site_url(), 'wp_version' => get_bloginfo('version'),
            'php_version' => phpversion(), 'theme' => get_stylesheet(),
            'locale' => get_locale(), 'timezone' => wp_timezone_string(),
            'plugin_count' => count($active_plugins),
            'plugins' => array_map(function ($p) { return explode('/', $p)[0]; }, $active_plugins),
        ];

        // Allow WC/Analytics plugins to inject their data
        $data = apply_filters('tinyeclipse_sync_data', $data, tinyeclipse_get_tenant_id());

        return $data;
    }

    /**
     * Run hourly scan — lightweight checks.
     */
    public function run_hourly_scan() {
        $report = [];

        if (class_exists('TinyEclipse_Security')) {
            $report['security'] = TinyEclipse_Security::instance()->audit();
        }
        if (class_exists('TinyEclipse_SEO')) {
            $report['seo'] = TinyEclipse_SEO::instance()->audit();
        }
        if (class_exists('TinyEclipse_Mail')) {
            $report['mail'] = TinyEclipse_Mail::instance()->audit();
        }

        $report['scanned_at'] = current_time('c');

        do_action('tinyeclipse_scan_complete', $report);

        tinyeclipse_log('collector', 'info', 'Hourly scan completed', [
            'security_score' => $report['security']['score'] ?? null,
            'seo_score'      => $report['seo']['score'] ?? null,
            'mail_score'     => $report['mail']['score'] ?? null,
        ]);

        return $report;
    }

    /**
     * Run daily report — full data collection + send to Hub.
     */
    public function run_daily_report() {
        $data = $this->collect_all();

        $tenant_id = tinyeclipse_get_tenant_id();
        if (empty($tenant_id)) return;

        // Send to Hub
        $response = wp_remote_post(TINYECLIPSE_API_BASE . '/api/admin/wp/' . $tenant_id . '/sync', [
            'timeout' => 60,
            'headers' => ['Content-Type' => 'application/json', 'X-Tenant-Id' => $tenant_id],
            'body'    => wp_json_encode($data),
        ]);

        $status = is_wp_error($response) ? 'error' : wp_remote_retrieve_response_code($response);
        update_option('tinyeclipse_last_sync', current_time('c'));

        // Store report
        global $wpdb;
        $table = $wpdb->prefix . 'tinyeclipse_reports';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $score = 0;
            $count = 0;
            foreach (['security', 'seo', 'mail'] as $mod) {
                if (isset($data[$mod]['score'])) {
                    $score += $data[$mod]['score'];
                    $count++;
                }
            }
            $wpdb->insert($table, [
                'report_type' => 'daily',
                'data'        => wp_json_encode($data),
                'score'       => $count > 0 ? round($score / $count) : 0,
                'created_at'  => current_time('mysql'),
            ]);
        }

        // Email report if configured
        $email = get_option('tinyeclipse_report_email', '');
        if (!empty($email) && get_option('tinyeclipse_auto_report', true)) {
            $this->send_report_email($email, $data);
        }

        tinyeclipse_log('collector', 'info', 'Daily report completed', ['status' => $status]);

        return ['status' => $status == 200 ? 'synced' : 'error', 'data_keys' => array_keys($data)];
    }

    /**
     * Send report email.
     */
    private function send_report_email($to, $data) {
        $site_name = get_bloginfo('name');
        $subject = "[TinyEclipse] Dagelijks rapport — {$site_name}";

        $scores = [];
        if (isset($data['security']['score'])) $scores[] = "Security: {$data['security']['score']}%";
        if (isset($data['seo']['score'])) $scores[] = "SEO: {$data['seo']['score']}%";
        if (isset($data['mail']['score'])) $scores[] = "Mail: {$data['mail']['score']}%";

        $body = "TinyEclipse Dagelijks Rapport\n";
        $body .= "Site: {$site_name} (" . get_site_url() . ")\n";
        $body .= "Datum: " . current_time('d-m-Y H:i') . "\n\n";
        $body .= "Scores:\n" . implode("\n", $scores) . "\n\n";
        $body .= "Bekijk het volledige rapport in Eclipse Hub:\n";
        $body .= TINYECLIPSE_HUB_URL . "\n";

        wp_mail($to, $subject, $body);
    }

    /**
     * Get latest report from DB.
     */
    public function get_latest_report() {
        global $wpdb;
        $table = $wpdb->prefix . 'tinyeclipse_reports';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) return null;

        $row = $wpdb->get_row("SELECT * FROM {$table} ORDER BY id DESC LIMIT 1");
        if (!$row) return null;

        return [
            'id'         => $row->id,
            'type'       => $row->report_type,
            'score'      => (int)$row->score,
            'data'       => json_decode($row->data, true),
            'created_at' => $row->created_at,
        ];
    }

    /**
     * Get snapshot — quick overview for REST API.
     */
    public function get_snapshot() {
        $health = apply_filters('tinyeclipse_health_modules', []);

        return [
            'site_url'    => get_site_url(),
            'site_name'   => get_bloginfo('name'),
            'version'     => TINYECLIPSE_VERSION,
            'environment' => tinyeclipse_is_staging() ? 'staging' : 'production',
            'modules'     => $health,
            'last_sync'   => get_option('tinyeclipse_last_sync', null),
            'timestamp'   => current_time('c'),
        ];
    }
}
