<?php
/**
 * TinyEclipse Update Guard
 * Prevents, don't cure — automated update protection for WordPress sites.
 *
 * Features:
 * - Pre-update vitals snapshot (response time, HTTP status, page checksums, PHP errors)
 * - Post-update verification (compare vitals, detect regression)
 * - Auto-rollback if something broke (plugin deactivation + restore)
 * - Update log with full audit trail
 * - Hub notification on every update event
 *
 * @since 5.1.0
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_Update_Guard {

    private static $instance = null;
    const OPTION_SNAPSHOTS = 'tinyeclipse_update_snapshots';
    const OPTION_LOG = 'tinyeclipse_update_log';
    const MAX_LOG_ENTRIES = 100;

    public static function instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        // Hook into WP update lifecycle
        add_action('upgrader_pre_install', [$this, 'before_update'], 10, 2);
        add_action('upgrader_process_complete', [$this, 'after_update'], 10, 2);

        // Specific hooks for core, plugin, theme updates
        add_filter('pre_auto_update', [$this, 'pre_auto_update_check'], 10, 2);
        add_action('automatic_updates_complete', [$this, 'after_auto_update']);

        // Plugin activation/deactivation monitoring
        add_action('activated_plugin', [$this, 'on_plugin_activated'], 10, 2);
        add_action('deactivated_plugin', [$this, 'on_plugin_deactivated'], 10, 2);

        // Scheduled verification (5 minutes after update)
        add_action('tinyeclipse_post_update_verify', [$this, 'run_post_update_verification']);

        // REST routes
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    // ═══════════════════════════════════════════════════════════════
    // PRE-UPDATE: Capture site vitals
    // ═══════════════════════════════════════════════════════════════

    /**
     * Capture a full vitals snapshot before any update.
     */
    public function capture_vitals_snapshot($trigger = 'manual') {
        $start = microtime(true);

        $snapshot = [
            'timestamp'    => current_time('mysql'),
            'trigger'      => $trigger,
            'wp_version'   => get_bloginfo('version'),
            'php_version'  => phpversion(),
            'active_plugins' => get_option('active_plugins', []),
            'active_theme' => get_stylesheet(),
            'checks'       => [],
        ];

        // 1. Homepage response check
        $snapshot['checks']['homepage'] = $this->check_url(home_url('/'));

        // 2. Admin response check
        $snapshot['checks']['admin'] = $this->check_url(admin_url('/'));

        // 3. REST API health
        $snapshot['checks']['rest_api'] = $this->check_url(rest_url('wp/v2/types'));

        // 4. Key pages (up to 5)
        $key_pages = $this->get_key_pages();
        foreach ($key_pages as $page) {
            $slug = sanitize_title($page['slug'] ?? 'page');
            $snapshot['checks']['page_' . $slug] = $this->check_url($page['url']);
        }

        // 5. PHP error log check
        $snapshot['checks']['php_errors'] = $this->check_php_errors();

        // 6. Database health
        $snapshot['checks']['database'] = $this->check_database();

        // 7. Disk space
        $snapshot['checks']['disk'] = $this->check_disk_space();

        // 8. Memory usage
        $snapshot['checks']['memory'] = [
            'status'    => 'ok',
            'current'   => memory_get_usage(true),
            'peak'      => memory_get_peak_usage(true),
            'limit'     => ini_get('memory_limit'),
        ];

        $snapshot['capture_time_ms'] = round((microtime(true) - $start) * 1000);

        // Store snapshot
        $snapshots = get_option(self::OPTION_SNAPSHOTS, []);
        $snapshot_id = 'snap_' . time() . '_' . wp_rand(1000, 9999);
        $snapshots[$snapshot_id] = $snapshot;

        // Keep only last 10 snapshots
        if (count($snapshots) > 10) {
            $snapshots = array_slice($snapshots, -10, 10, true);
        }
        update_option(self::OPTION_SNAPSHOTS, $snapshots);

        return ['id' => $snapshot_id, 'snapshot' => $snapshot];
    }

    /**
     * Hook: Before any update starts.
     */
    public function before_update($return, $hook_extra) {
        $type = 'unknown';
        if (isset($hook_extra['plugin'])) $type = 'plugin:' . $hook_extra['plugin'];
        elseif (isset($hook_extra['theme'])) $type = 'theme:' . $hook_extra['theme'];
        elseif (isset($hook_extra['type'])) $type = $hook_extra['type'];

        $result = $this->capture_vitals_snapshot('pre_update:' . $type);

        $this->log_event('pre_update', [
            'type'        => $type,
            'snapshot_id' => $result['id'],
        ]);

        // Notify Hub
        $this->notify_hub('pre_update', [
            'type'        => $type,
            'snapshot_id' => $result['id'],
            'vitals'      => $this->summarize_snapshot($result['snapshot']),
        ]);

        return $return;
    }

    /**
     * Hook: After update completes.
     */
    public function after_update($upgrader, $hook_extra) {
        $type = $hook_extra['type'] ?? 'unknown';
        $action = $hook_extra['action'] ?? 'update';

        $items = [];
        if (isset($hook_extra['plugins'])) $items = $hook_extra['plugins'];
        elseif (isset($hook_extra['themes'])) $items = $hook_extra['themes'];

        // Schedule post-update verification in 30 seconds (let caches settle)
        wp_schedule_single_event(time() + 30, 'tinyeclipse_post_update_verify', [[
            'type'   => $type,
            'action' => $action,
            'items'  => $items,
        ]]);

        $this->log_event('update_completed', [
            'type'   => $type,
            'action' => $action,
            'items'  => $items,
        ]);
    }

    /**
     * Hook: Before auto-update proceeds.
     */
    public function pre_auto_update_check($update, $item) {
        $this->capture_vitals_snapshot('pre_auto_update');
        return $update;
    }

    /**
     * Hook: After auto-update completes.
     */
    public function after_auto_update($results) {
        wp_schedule_single_event(time() + 60, 'tinyeclipse_post_update_verify', [[
            'type'   => 'auto_update',
            'action' => 'update',
            'items'  => array_keys($results),
        ]]);
    }

    // ═══════════════════════════════════════════════════════════════
    // POST-UPDATE: Verify vitals and detect regression
    // ═══════════════════════════════════════════════════════════════

    /**
     * Run post-update verification and compare with pre-update snapshot.
     */
    public function run_post_update_verification($context = []) {
        $post_snapshot = $this->capture_vitals_snapshot('post_update_verify');
        $pre_snapshot = $this->get_latest_pre_snapshot();

        if (!$pre_snapshot) {
            $this->log_event('verify_no_baseline', ['context' => $context]);
            return;
        }

        $comparison = $this->compare_snapshots($pre_snapshot, $post_snapshot['snapshot']);

        $this->log_event('post_update_verify', [
            'context'    => $context,
            'comparison' => $comparison,
            'verdict'    => $comparison['verdict'],
        ]);

        // Notify Hub with full comparison
        $this->notify_hub('post_update_verify', [
            'context'    => $context,
            'comparison' => $comparison,
            'verdict'    => $comparison['verdict'],
        ]);

        // AUTO-ROLLBACK if critical issues detected
        if ($comparison['verdict'] === 'critical') {
            $this->trigger_rollback($context, $comparison);
        } elseif ($comparison['verdict'] === 'warning') {
            // Schedule a re-check in 5 minutes
            wp_schedule_single_event(time() + 300, 'tinyeclipse_post_update_verify', [$context]);
        }

        return $comparison;
    }

    /**
     * Compare pre and post snapshots.
     */
    private function compare_snapshots($pre, $post) {
        $issues = [];
        $improvements = [];
        $severity = 'ok';

        foreach ($post['checks'] as $key => $post_check) {
            $pre_check = $pre['checks'][$key] ?? null;
            if (!$pre_check) continue;

            // HTTP status regression
            if (isset($post_check['http_status']) && isset($pre_check['http_status'])) {
                if ($pre_check['http_status'] === 200 && $post_check['http_status'] !== 200) {
                    $issues[] = [
                        'check'    => $key,
                        'type'     => 'http_status_regression',
                        'before'   => $pre_check['http_status'],
                        'after'    => $post_check['http_status'],
                        'severity' => 'critical',
                    ];
                    $severity = 'critical';
                }
            }

            // Response time regression (>2x slower = warning, >5x = critical)
            if (isset($post_check['response_ms']) && isset($pre_check['response_ms']) && $pre_check['response_ms'] > 0) {
                $ratio = $post_check['response_ms'] / $pre_check['response_ms'];
                if ($ratio > 5) {
                    $issues[] = [
                        'check'    => $key,
                        'type'     => 'response_time_critical',
                        'before'   => $pre_check['response_ms'],
                        'after'    => $post_check['response_ms'],
                        'ratio'    => round($ratio, 1),
                        'severity' => 'critical',
                    ];
                    $severity = 'critical';
                } elseif ($ratio > 2) {
                    $issues[] = [
                        'check'    => $key,
                        'type'     => 'response_time_warning',
                        'before'   => $pre_check['response_ms'],
                        'after'    => $post_check['response_ms'],
                        'ratio'    => round($ratio, 1),
                        'severity' => 'warning',
                    ];
                    if ($severity !== 'critical') $severity = 'warning';
                } elseif ($ratio < 0.8) {
                    $improvements[] = [
                        'check' => $key,
                        'type'  => 'response_time_improved',
                        'ratio' => round($ratio, 1),
                    ];
                }
            }

            // Content hash change (potential broken page)
            if (isset($post_check['content_hash']) && isset($pre_check['content_hash'])) {
                if ($post_check['content_hash'] !== $pre_check['content_hash']) {
                    // Content changed — not necessarily bad, but worth noting
                    if (isset($post_check['content_length']) && isset($pre_check['content_length'])) {
                        $length_ratio = $pre_check['content_length'] > 0
                            ? $post_check['content_length'] / $pre_check['content_length']
                            : 0;
                        // If content shrank dramatically (>50% smaller), likely broken
                        if ($length_ratio < 0.5 && $pre_check['content_length'] > 500) {
                            $issues[] = [
                                'check'    => $key,
                                'type'     => 'content_shrunk',
                                'before'   => $pre_check['content_length'],
                                'after'    => $post_check['content_length'],
                                'severity' => 'critical',
                            ];
                            $severity = 'critical';
                        }
                    }
                }
            }
        }

        // PHP error increase
        $pre_errors = $pre['checks']['php_errors']['error_count'] ?? 0;
        $post_errors = $post['checks']['php_errors']['error_count'] ?? 0;
        if ($post_errors > $pre_errors + 5) {
            $issues[] = [
                'type'     => 'php_errors_increased',
                'before'   => $pre_errors,
                'after'    => $post_errors,
                'severity' => 'warning',
            ];
            if ($severity !== 'critical') $severity = 'warning';
        }

        return [
            'verdict'      => $severity,
            'issues'       => $issues,
            'improvements' => $improvements,
            'checks_compared' => count($post['checks']),
        ];
    }

    // ═══════════════════════════════════════════════════════════════
    // AUTO-ROLLBACK
    // ═══════════════════════════════════════════════════════════════

    /**
     * Trigger automatic rollback when critical issues are detected.
     */
    private function trigger_rollback($context, $comparison) {
        $type = $context['type'] ?? 'unknown';
        $items = $context['items'] ?? [];

        $rolled_back = [];

        // For plugin updates: deactivate the updated plugins
        if ($type === 'plugin' && !empty($items)) {
            foreach ($items as $plugin) {
                if (is_plugin_active($plugin) && $plugin !== 'tinyeclipse-connector/tinyeclipse-connector.php') {
                    deactivate_plugins($plugin);
                    $rolled_back[] = $plugin;
                }
            }
        }

        // For theme updates: switch back if we have a record of the previous theme
        $pre_snapshot = $this->get_latest_pre_snapshot();
        if ($type === 'theme' && $pre_snapshot && isset($pre_snapshot['active_theme'])) {
            $previous_theme = $pre_snapshot['active_theme'];
            if ($previous_theme !== get_stylesheet() && wp_get_theme($previous_theme)->exists()) {
                switch_theme($previous_theme);
                $rolled_back[] = 'theme:' . $previous_theme;
            }
        }

        $this->log_event('auto_rollback', [
            'context'     => $context,
            'comparison'  => $comparison,
            'rolled_back' => $rolled_back,
        ]);

        // Notify Hub about rollback
        $this->notify_hub('auto_rollback', [
            'context'     => $context,
            'issues'      => $comparison['issues'],
            'rolled_back' => $rolled_back,
            'verdict'     => 'rollback_executed',
        ]);

        // Schedule re-verification after rollback
        wp_schedule_single_event(time() + 60, 'tinyeclipse_post_update_verify', [[
            'type'   => 'rollback_verify',
            'action' => 'rollback',
            'items'  => $rolled_back,
        ]]);

        return $rolled_back;
    }

    // ═══════════════════════════════════════════════════════════════
    // PLUGIN ACTIVATION/DEACTIVATION MONITORING
    // ═══════════════════════════════════════════════════════════════

    public function on_plugin_activated($plugin, $network_wide) {
        $this->log_event('plugin_activated', ['plugin' => $plugin, 'network' => $network_wide]);
        // Schedule a quick health check
        wp_schedule_single_event(time() + 15, 'tinyeclipse_post_update_verify', [[
            'type'   => 'plugin_activation',
            'action' => 'activate',
            'items'  => [$plugin],
        ]]);
    }

    public function on_plugin_deactivated($plugin, $network_wide) {
        $this->log_event('plugin_deactivated', ['plugin' => $plugin, 'network' => $network_wide]);
    }

    // ═══════════════════════════════════════════════════════════════
    // VITALS CHECK HELPERS
    // ═══════════════════════════════════════════════════════════════

    private function check_url($url) {
        $start = microtime(true);
        $response = wp_remote_get($url, [
            'timeout'   => 15,
            'sslverify' => false,
            'headers'   => ['User-Agent' => 'TinyEclipse-UpdateGuard/1.0'],
        ]);
        $elapsed = round((microtime(true) - $start) * 1000);

        if (is_wp_error($response)) {
            return [
                'status'      => 'error',
                'http_status' => 0,
                'response_ms' => $elapsed,
                'error'       => $response->get_error_message(),
            ];
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);

        return [
            'status'         => ($code >= 200 && $code < 400) ? 'ok' : 'error',
            'http_status'    => $code,
            'response_ms'    => $elapsed,
            'content_length' => strlen($body),
            'content_hash'   => md5($body),
        ];
    }

    private function check_php_errors() {
        $error_log = ini_get('error_log');
        $errors = [];
        $error_count = 0;

        if ($error_log && file_exists($error_log) && is_readable($error_log)) {
            $size = filesize($error_log);
            // Read last 10KB
            $fp = fopen($error_log, 'r');
            if ($fp) {
                $offset = max(0, $size - 10240);
                fseek($fp, $offset);
                $content = fread($fp, 10240);
                fclose($fp);

                $lines = explode("\n", $content);
                $recent_errors = [];
                $cutoff = strtotime('-1 hour');

                foreach ($lines as $line) {
                    if (preg_match('/\[(.*?)\]\s*(PHP\s+(?:Fatal|Warning|Notice|Error).*)/', $line, $m)) {
                        $error_count++;
                        if (strtotime($m[1]) >= $cutoff) {
                            $recent_errors[] = substr($m[2], 0, 200);
                        }
                    }
                }
                $errors = array_slice($recent_errors, -5);
            }
        }

        return [
            'status'        => $error_count > 10 ? 'warning' : 'ok',
            'error_count'   => $error_count,
            'recent_errors' => $errors,
            'log_file'      => $error_log ?: 'not configured',
        ];
    }

    private function check_database() {
        global $wpdb;
        $start = microtime(true);

        try {
            $result = $wpdb->get_var("SELECT 1");
            $elapsed = round((microtime(true) - $start) * 1000);

            $table_count = $wpdb->get_var("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()");

            return [
                'status'      => 'ok',
                'response_ms' => $elapsed,
                'tables'      => (int) $table_count,
                'db_size_mb'  => round($wpdb->get_var("SELECT SUM(data_length + index_length) / 1024 / 1024 FROM information_schema.tables WHERE table_schema = DATABASE()") ?? 0, 1),
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'error'  => $e->getMessage(),
            ];
        }
    }

    private function check_disk_space() {
        $path = ABSPATH;
        $free = @disk_free_space($path);
        $total = @disk_total_space($path);

        if ($free === false || $total === false) {
            return ['status' => 'unknown', 'error' => 'Cannot determine disk space'];
        }

        $used_pct = round((1 - $free / $total) * 100, 1);
        return [
            'status'   => $used_pct > 95 ? 'critical' : ($used_pct > 85 ? 'warning' : 'ok'),
            'free_mb'  => round($free / 1024 / 1024),
            'total_mb' => round($total / 1024 / 1024),
            'used_pct' => $used_pct,
        ];
    }

    private function get_key_pages() {
        $pages = [];

        // Homepage
        $front_page_id = get_option('page_on_front');
        if ($front_page_id) {
            $pages[] = ['slug' => 'front', 'url' => get_permalink($front_page_id)];
        }

        // Shop page (WooCommerce)
        if (function_exists('wc_get_page_id')) {
            $shop_id = wc_get_page_id('shop');
            if ($shop_id > 0) {
                $pages[] = ['slug' => 'shop', 'url' => get_permalink($shop_id)];
            }
        }

        // Contact page (heuristic)
        $contact = get_page_by_path('contact');
        if ($contact) {
            $pages[] = ['slug' => 'contact', 'url' => get_permalink($contact->ID)];
        }

        return array_slice($pages, 0, 5);
    }

    // ═══════════════════════════════════════════════════════════════
    // HUB COMMUNICATION
    // ═══════════════════════════════════════════════════════════════

    private function notify_hub($action, $data) {
        $tenant_id = tinyeclipse_get_tenant_id();
        if (empty($tenant_id)) return;

        $payload = [
            'action'    => $action,
            'domain'    => home_url(),
            'timestamp' => current_time('c'),
            'data'      => $data,
        ];

        wp_remote_post(TINYECLIPSE_API_BASE . '/api/admin/wp/' . $tenant_id . '/update-guard', [
            'timeout'   => 5,
            'blocking'  => false,
            'headers'   => ['Content-Type' => 'application/json'],
            'body'      => wp_json_encode($payload),
        ]);
    }

    private function summarize_snapshot($snapshot) {
        $summary = ['checks' => count($snapshot['checks']), 'issues' => 0];
        foreach ($snapshot['checks'] as $check) {
            if (($check['status'] ?? 'ok') !== 'ok') $summary['issues']++;
        }
        $summary['capture_time_ms'] = $snapshot['capture_time_ms'] ?? 0;
        return $summary;
    }

    // ═══════════════════════════════════════════════════════════════
    // LOGGING
    // ═══════════════════════════════════════════════════════════════

    private function log_event($action, $data = []) {
        $log = get_option(self::OPTION_LOG, []);
        $log[] = [
            'action'    => $action,
            'timestamp' => current_time('mysql'),
            'data'      => $data,
        ];

        // Keep last N entries
        if (count($log) > self::MAX_LOG_ENTRIES) {
            $log = array_slice($log, -self::MAX_LOG_ENTRIES);
        }
        update_option(self::OPTION_LOG, $log);
    }

    private function get_latest_pre_snapshot() {
        $snapshots = get_option(self::OPTION_SNAPSHOTS, []);
        foreach (array_reverse($snapshots) as $snap) {
            if (strpos($snap['trigger'] ?? '', 'pre_') === 0) {
                return $snap;
            }
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════════
    // REST API
    // ═══════════════════════════════════════════════════════════════

    public function register_routes() {
        $ns = 'tinyeclipse/v1';

        register_rest_route($ns, '/update-guard/snapshot', [
            'methods'             => 'POST',
            'callback'            => [$this, 'rest_capture_snapshot'],
            'permission_callback' => function () { return current_user_can('manage_options'); },
        ]);

        register_rest_route($ns, '/update-guard/status', [
            'methods'             => 'GET',
            'callback'            => [$this, 'rest_get_status'],
            'permission_callback' => function () { return current_user_can('manage_options'); },
        ]);

        register_rest_route($ns, '/update-guard/verify', [
            'methods'             => 'POST',
            'callback'            => [$this, 'rest_run_verify'],
            'permission_callback' => function () { return current_user_can('manage_options'); },
        ]);

        register_rest_route($ns, '/update-guard/log', [
            'methods'             => 'GET',
            'callback'            => [$this, 'rest_get_log'],
            'permission_callback' => function () { return current_user_can('manage_options'); },
        ]);
    }

    public function rest_capture_snapshot($request) {
        $result = $this->capture_vitals_snapshot('manual_rest');
        return new \WP_REST_Response($result, 200);
    }

    public function rest_get_status() {
        $snapshots = get_option(self::OPTION_SNAPSHOTS, []);
        $log = get_option(self::OPTION_LOG, []);
        $last_snapshot = !empty($snapshots) ? end($snapshots) : null;
        $last_events = array_slice($log, -10);

        // Count rollbacks
        $rollback_count = 0;
        foreach ($log as $entry) {
            if (($entry['action'] ?? '') === 'auto_rollback') $rollback_count++;
        }

        return new \WP_REST_Response([
            'enabled'         => true,
            'snapshots_count' => count($snapshots),
            'last_snapshot'   => $last_snapshot,
            'rollback_count'  => $rollback_count,
            'recent_events'   => $last_events,
            'wp_version'      => get_bloginfo('version'),
            'active_plugins'  => count(get_option('active_plugins', [])),
        ], 200);
    }

    public function rest_run_verify($request) {
        $result = $this->run_post_update_verification(['type' => 'manual', 'action' => 'verify']);
        return new \WP_REST_Response($result, 200);
    }

    public function rest_get_log() {
        $log = get_option(self::OPTION_LOG, []);
        return new \WP_REST_Response([
            'entries' => array_reverse($log),
            'total'   => count($log),
        ], 200);
    }
}
