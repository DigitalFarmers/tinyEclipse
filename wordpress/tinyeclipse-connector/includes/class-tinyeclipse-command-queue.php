<?php
/**
 * TinyEclipse Command Queue Handler
 * Processes commands from the Eclipse Hub command queue.
 * Handles polling, execution, and result reporting.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_Command_Queue {
    private static $instance = null;
    private $poll_interval = 60; // seconds
    private $max_execution_time = 30; // seconds per command

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {
        // Register REST endpoints
        add_action('rest_api_init', [$this, 'register_rest_routes']);
        
        // Setup cron for polling
        add_action('wp', [$this, 'maybe_schedule_poll']);
        add_action('tinyeclipse_poll_commands', [$this, 'poll_and_process']);
        
        // Add admin notice for failed commands
        add_action('admin_notices', [$this, 'admin_notices']);
    }

    /**
     * Register REST API routes for command queue.
     */
    public function register_rest_routes() {
        register_rest_route('tinyeclipse/v1', '/commands/poll', [
            'methods' => 'GET',
            'callback' => [$this, 'rest_poll_commands'],
            'permission_callback' => [$this, 'check_permissions'],
        ]);

        register_rest_route('tinyeclipse/v1', '/commands/(?P<id>[a-f0-9-]+)/execute', [
            'methods' => 'POST',
            'callback' => [$this, 'rest_execute_command'],
            'permission_callback' => [$this, 'check_permissions'],
            'args' => [
                'id' => [
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_string($param) && preg_match('/^[a-f0-9-]{36}$/', $param);
                    }
                ]
            ]
        ]);

        register_rest_route('tinyeclipse/v1', '/commands/(?P<id>[a-f0-9-]+)/result', [
            'methods' => 'POST',
            'callback' => [$this, 'rest_report_result'],
            'permission_callback' => [$this, 'check_permissions'],
            'args' => [
                'id' => [
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_string($param) && preg_match('/^[a-f0-9-]{36}$/', $param);
                    }
                ],
                'result' => ['required' => false],
                'success' => ['required' => false],
                'error_message' => ['required' => false]
            ]
        ]);
    }

    /**
     * Check if request has proper permissions (tenant ID).
     */
    public function check_permissions($request) {
        $tenant_id = $request->get_param('tenant_id') ?: $request->get_header('X-Tenant-Id');
        return $tenant_id && $tenant_id === tinyeclipse_get_tenant_id();
    }

    /**
     * REST endpoint: Poll for pending commands.
     */
    public function rest_poll_commands($request) {
        $tenant_id = tinyeclipse_get_tenant_id();
        $limit = intval($request->get_param('limit')) ?: 10;
        
        $response = wp_remote_get(TINYECLIPSE_API_BASE . "/api/commands/{$tenant_id}/poll?limit={$limit}", [
            'timeout' => 10,
            'headers' => [
                'X-Tenant-Id' => $tenant_id,
                'User-Agent' => 'TinyEclipse-Connector/' . TINYECLIPSE_VERSION,
            ]
        ]);

        if (is_wp_error($response)) {
            tinyeclipse_log('command_queue', 'error', 'Failed to poll commands', [
                'error' => $response->get_error_message()
            ]);
            return new WP_Error('poll_failed', 'Failed to poll commands', ['status' => 500]);
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (!$data || !isset($data['commands'])) {
            return new WP_Error('invalid_response', 'Invalid response from Hub', ['status' => 500]);
        }

        // Store commands in transient for processing
        set_transient('tinyeclipse_pending_commands', $data['commands'], 300);
        
        tinyeclipse_log('command_queue', 'info', 'Polled commands', [
            'count' => count($data['commands']),
            'command_ids' => array_column($data['commands'], 'id')
        ]);

        return [
            'success' => true,
            'commands' => $data['commands'],
            'count' => count($data['commands'])
        ];
    }

    /**
     * REST endpoint: Execute a specific command.
     */
    public function rest_execute_command($request) {
        $command_id = $request['id'];
        $tenant_id = tinyeclipse_get_tenant_id();
        
        // Get command from Hub
        $response = wp_remote_get(TINYECLIPSE_API_BASE . "/api/admin/commands/{$command_id}", [
            'timeout' => 10,
            'headers' => [
                'X-Admin-Key' => get_option('tinyeclipse_hub_admin_key', ''),
                'User-Agent' => 'TinyEclipse-Connector/' . TINYECLIPSE_VERSION,
            ]
        ]);

        if (is_wp_error($response)) {
            return new WP_Error('fetch_failed', 'Failed to fetch command', ['status' => 500]);
        }

        $body = wp_remote_retrieve_body($response);
        $command = json_decode($body, true);

        if (!$command) {
            return new WP_Error('invalid_command', 'Command not found', ['status' => 404]);
        }

        // Execute command
        $result = $this->execute_command($command);
        
        // Report result back to Hub
        $this->report_command_result($command_id, $result);
        
        return $result;
    }

    /**
     * REST endpoint: Report command execution result.
     */
    public function rest_report_result($request) {
        $command_id = $request['id'];
        $result = $request->get_param('result') ?: [];
        $success = $request->get_param('success') !== false;
        $error_message = $request->get_param('error_message');

        return $this->report_command_result($command_id, [
            'success' => $success,
            'result' => $result,
            'error_message' => $error_message
        ]);
    }

    /**
     * Execute a command and return result.
     */
    private function execute_command($command) {
        $start_time = microtime(true);
        $command_type = $command['command_type'];
        $payload = $command['payload'];
        
        tinyeclipse_log('command_queue', 'info', 'Executing command', [
            'id' => $command['id'],
            'type' => $command_type,
            'payload' => $payload
        ]);

        $result = [
            'success' => false,
            'result' => null,
            'error_message' => null,
            'execution_time' => 0
        ];

        try {
            switch ($command_type) {
                case 'scan':
                    $result['result'] = $this->execute_scan($payload);
                    $result['success'] = true;
                    break;

                case 'report':
                    $result['result'] = $this->execute_report($payload);
                    $result['success'] = true;
                    break;

                case 'sync':
                    $result['result'] = $this->execute_sync($payload);
                    $result['success'] = true;
                    break;

                case 'heartbeat':
                    $result['result'] = $this->execute_heartbeat($payload);
                    $result['success'] = true;
                    break;

                case 'flush_cache':
                    $result['result'] = $this->execute_flush_cache($payload);
                    $result['success'] = true;
                    break;

                case 'update_config':
                    $result['result'] = $this->execute_update_config($payload);
                    $result['success'] = true;
                    break;

                case 'plugin_update':
                    $result['result'] = $this->execute_plugin_update($payload);
                    $result['success'] = true;
                    break;

                case 'security_scan':
                    $result['result'] = $this->execute_security_scan($payload);
                    $result['success'] = true;
                    break;

                case 'deep_scan':
                    $result['result'] = $this->execute_deep_scan($payload);
                    $result['success'] = true;
                    break;

                // ─── Auto-Fix Commands (AI Priority Inbox) ───
                case 'fix_security_headers':
                    $result['result'] = $this->execute_fix_security_headers($payload);
                    $result['success'] = true;
                    break;

                case 'fix_debug_mode':
                    $result['result'] = $this->execute_fix_debug_mode($payload);
                    $result['success'] = true;
                    break;

                case 'fix_file_editor':
                    $result['result'] = $this->execute_fix_file_editor($payload);
                    $result['success'] = true;
                    break;

                case 'fix_file_permissions':
                    $result['result'] = $this->execute_fix_file_permissions($payload);
                    $result['success'] = true;
                    break;

                default:
                    // Allow other plugins to handle custom commands
                    $custom_result = apply_filters('tinyeclipse_execute_custom_command', null, $command_type, $payload);
                    if ($custom_result !== null) {
                        $result['result'] = $custom_result;
                        $result['success'] = true;
                    } else {
                        $result['error_message'] = "Unknown command type: {$command_type}";
                    }
                    break;
            }
        } catch (Exception $e) {
            $result['error_message'] = $e->getMessage();
            tinyeclipse_log('command_queue', 'error', 'Command execution failed', [
                'id' => $command['id'],
                'type' => $command_type,
                'error' => $e->getMessage()
            ]);
        }

        $result['execution_time'] = round(microtime(true) - $start_time, 2);
        
        tinyeclipse_log('command_queue', 'info', 'Command executed', [
            'id' => $command['id'],
            'type' => $command_type,
            'success' => $result['success'],
            'execution_time' => $result['execution_time']
        ]);

        return $result;
    }

    /**
     * Report command result back to Hub.
     */
    private function report_command_result($command_id, $result) {
        $tenant_id = tinyeclipse_get_tenant_id();
        
        $response = wp_remote_post(TINYECLIPSE_API_BASE . "/api/commands/{$command_id}/result", [
            'timeout' => 10,
            'headers' => [
                'Content-Type' => 'application/json',
                'X-Tenant-Id' => $tenant_id,
                'User-Agent' => 'TinyEclipse-Connector/' . TINYECLIPSE_VERSION,
            ],
            'body' => wp_json_encode([
                'result' => $result['result'] ?? null,
                'success' => $result['success'] ?? false,
                'error_message' => $result['error_message'] ?? null
            ])
        ]);

        if (is_wp_error($response)) {
            tinyeclipse_log('command_queue', 'error', 'Failed to report command result', [
                'command_id' => $command_id,
                'error' => $response->get_error_message()
            ]);
            return false;
        }

        $status = wp_remote_retrieve_response_code($response);
        $success = $status >= 200 && $status < 300;

        tinyeclipse_log('command_queue', $success ? 'info' : 'error', 'Command result reported', [
            'command_id' => $command_id,
            'status' => $status,
            'success' => $success
        ]);

        return $success;
    }

    /**
     * Command execution methods.
     */

    private function execute_scan($payload) {
        if (class_exists('TinyEclipse_Collector')) {
            return TinyEclipse_Collector::instance()->run_hourly_scan();
        }
        return ['error' => 'Collector class not available'];
    }

    private function execute_report($payload) {
        if (class_exists('TinyEclipse_Collector')) {
            return TinyEclipse_Collector::instance()->run_daily_report();
        }
        return ['error' => 'Collector class not available'];
    }

    private function execute_sync($payload) {
        // Trigger full sync
        do_action('tinyeclipse_full_sync', $payload);
        return ['sync_triggered' => true];
    }

    private function execute_heartbeat($payload) {
        // Force immediate heartbeat
        delete_transient('tinyeclipse_last_heartbeat');
        if (class_exists('TinyEclipse_Hub')) {
            TinyEclipse_Hub::instance()->maybe_heartbeat();
        }
        return ['heartbeat_sent' => true];
    }

    private function execute_flush_cache($payload) {
        $flushed = false;
        
        // WordPress cache
        if (function_exists('wp_cache_flush')) {
            wp_cache_flush();
            $flushed = true;
        }
        
        // Object cache
        if (function_exists('wp_object_cache_flush')) {
            wp_object_cache_flush();
            $flushed = true;
        }
        
        // Plugin-specific caches
        do_action('tinyeclipse_flush_cache', $payload);
        
        return ['cache_flushed' => $flushed];
    }

    private function execute_update_config($payload) {
        $updated = 0;
        
        if (!empty($payload) && is_array($payload)) {
            foreach ($payload as $key => $value) {
                if (strpos($key, 'tinyeclipse_') === 0) {
                    update_option($key, $value);
                    $updated++;
                }
            }
        }
        
        return ['options_updated' => $updated];
    }

    private function execute_plugin_update($payload) {
        $plugin_slug = $payload['plugin_slug'] ?? '';
        $version = $payload['version'] ?? '';
        
        if (empty($plugin_slug)) {
            return ['error' => 'Plugin slug required'];
        }
        
        // Use WordPress built-in update functionality
        include_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        include_once ABSPATH . 'wp-admin/includes/plugin-install.php';
        
        $skin = new Automatic_Upgrader_Skin();
        $upgrader = new Plugin_Upgrader($skin);
        
        $result = $upgrader->upgrade($plugin_slug);
        
        return [
            'plugin' => $plugin_slug,
            'success' => is_array($result) && !is_wp_error($result),
            'result' => $result
        ];
    }

    private function execute_security_scan($payload) {
        if (class_exists('TinyEclipse_Security')) {
            return TinyEclipse_Security::instance()->run_security_scan();
        }
        return ['error' => 'Security class not available'];
    }

    private function execute_deep_scan($payload) {
        if (class_exists('TinyEclipse_Site_Intelligence')) {
            return TinyEclipse_Site_Intelligence::instance()->run_deep_scan();
        }
        return ['error' => 'Site Intelligence class not available'];
    }

    // ─── Auto-Fix Methods (AI Priority Inbox) ───

    private function execute_fix_security_headers($payload) {
        $htaccess_path = ABSPATH . '.htaccess';
        if (!file_exists($htaccess_path) || !is_writable($htaccess_path)) {
            return ['error' => '.htaccess not found or not writable', 'path' => $htaccess_path];
        }

        $content = file_get_contents($htaccess_path);
        $marker_start = '# BEGIN TinyEclipse Security Headers';
        $marker_end = '# END TinyEclipse Security Headers';

        // Remove existing block if present
        $pattern = '/' . preg_quote($marker_start, '/') . '.*?' . preg_quote($marker_end, '/') . '/s';
        $content = preg_replace($pattern, '', $content);

        $headers = [
            'Header always set X-Content-Type-Options "nosniff"',
            'Header always set X-Frame-Options "SAMEORIGIN"',
            'Header always set X-XSS-Protection "1; mode=block"',
            'Header always set Referrer-Policy "strict-origin-when-cross-origin"',
            'Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"',
        ];

        // Add HSTS only if SSL is active
        if (is_ssl()) {
            array_unshift($headers, 'Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"');
        }

        $block = "\n{$marker_start}\n<IfModule mod_headers.c>\n";
        foreach ($headers as $h) {
            $block .= "    {$h}\n";
        }
        $block .= "</IfModule>\n{$marker_end}\n";

        // Insert before WordPress rewrite rules
        if (strpos($content, '# BEGIN WordPress') !== false) {
            $content = str_replace('# BEGIN WordPress', $block . '# BEGIN WordPress', $content);
        } else {
            $content = $block . $content;
        }

        file_put_contents($htaccess_path, $content);

        tinyeclipse_log('auto_fix', 'info', 'Security headers added to .htaccess', [
            'headers_count' => count($headers),
            'ssl' => is_ssl(),
        ]);

        return [
            'fixed' => true,
            'headers_added' => count($headers),
            'ssl_hsts' => is_ssl(),
        ];
    }

    private function execute_fix_debug_mode($payload) {
        $wp_config = ABSPATH . 'wp-config.php';
        if (!file_exists($wp_config)) {
            $wp_config = dirname(ABSPATH) . '/wp-config.php';
        }
        if (!file_exists($wp_config) || !is_writable($wp_config)) {
            return ['error' => 'wp-config.php not found or not writable'];
        }

        $content = file_get_contents($wp_config);
        $changes = [];

        // Disable WP_DEBUG
        if (preg_match("/define\s*\(\s*['\"]WP_DEBUG['\"]\s*,\s*true\s*\)/i", $content)) {
            $content = preg_replace(
                "/define\s*\(\s*['\"]WP_DEBUG['\"]\s*,\s*true\s*\)/i",
                "define('WP_DEBUG', false)",
                $content
            );
            $changes[] = 'WP_DEBUG set to false';
        }

        // Disable WP_DEBUG_DISPLAY
        if (preg_match("/define\s*\(\s*['\"]WP_DEBUG_DISPLAY['\"]\s*,\s*true\s*\)/i", $content)) {
            $content = preg_replace(
                "/define\s*\(\s*['\"]WP_DEBUG_DISPLAY['\"]\s*,\s*true\s*\)/i",
                "define('WP_DEBUG_DISPLAY', false)",
                $content
            );
            $changes[] = 'WP_DEBUG_DISPLAY set to false';
        }

        // Disable WP_DEBUG_LOG if displaying
        if (preg_match("/define\s*\(\s*['\"]WP_DEBUG_LOG['\"]\s*,\s*true\s*\)/i", $content)) {
            $content = preg_replace(
                "/define\s*\(\s*['\"]WP_DEBUG_LOG['\"]\s*,\s*true\s*\)/i",
                "define('WP_DEBUG_LOG', false)",
                $content
            );
            $changes[] = 'WP_DEBUG_LOG set to false';
        }

        if (!empty($changes)) {
            file_put_contents($wp_config, $content);
            tinyeclipse_log('auto_fix', 'info', 'Debug mode disabled', ['changes' => $changes]);
        }

        return [
            'fixed' => !empty($changes),
            'changes' => $changes,
            'message' => empty($changes) ? 'Debug mode was already disabled' : 'Debug mode disabled',
        ];
    }

    private function execute_fix_file_editor($payload) {
        $wp_config = ABSPATH . 'wp-config.php';
        if (!file_exists($wp_config)) {
            $wp_config = dirname(ABSPATH) . '/wp-config.php';
        }
        if (!file_exists($wp_config) || !is_writable($wp_config)) {
            return ['error' => 'wp-config.php not found or not writable'];
        }

        $content = file_get_contents($wp_config);

        // Check if already defined
        if (strpos($content, 'DISALLOW_FILE_EDIT') !== false) {
            // Already present — ensure it's true
            if (preg_match("/define\s*\(\s*['\"]DISALLOW_FILE_EDIT['\"]\s*,\s*false\s*\)/i", $content)) {
                $content = preg_replace(
                    "/define\s*\(\s*['\"]DISALLOW_FILE_EDIT['\"]\s*,\s*false\s*\)/i",
                    "define('DISALLOW_FILE_EDIT', true)",
                    $content
                );
                file_put_contents($wp_config, $content);
                tinyeclipse_log('auto_fix', 'info', 'DISALLOW_FILE_EDIT set to true');
                return ['fixed' => true, 'action' => 'changed_to_true'];
            }
            return ['fixed' => false, 'message' => 'DISALLOW_FILE_EDIT already set to true'];
        }

        // Add before "That's all, stop editing!" or before wp-settings require
        $insert = "\n/** Disable file editing in admin — added by TinyEclipse */\ndefine('DISALLOW_FILE_EDIT', true);\n";

        if (strpos($content, "That's all, stop editing") !== false) {
            $content = str_replace("/* That's all, stop editing", $insert . "/* That's all, stop editing", $content);
        } elseif (strpos($content, 'wp-settings.php') !== false) {
            $content = preg_replace(
                "/(require_once.*wp-settings\.php.*)/",
                $insert . "$1",
                $content,
                1
            );
        } else {
            $content .= $insert;
        }

        file_put_contents($wp_config, $content);
        tinyeclipse_log('auto_fix', 'info', 'DISALLOW_FILE_EDIT added to wp-config.php');

        return ['fixed' => true, 'action' => 'added_constant'];
    }

    private function execute_fix_file_permissions($payload) {
        $fixes = [];
        $sensitive_files = [
            ABSPATH . 'wp-config.php' => '0440',
            ABSPATH . '.htaccess' => '0644',
        ];

        foreach ($sensitive_files as $file => $target_perms) {
            if (!file_exists($file)) continue;

            $current = substr(sprintf('%o', fileperms($file)), -4);
            $target_octal = intval($target_perms, 8);

            if ($current !== $target_perms) {
                $result = @chmod($file, $target_octal);
                $fixes[] = [
                    'file' => basename($file),
                    'from' => $current,
                    'to' => $target_perms,
                    'success' => $result,
                ];
            }
        }

        if (!empty($fixes)) {
            tinyeclipse_log('auto_fix', 'info', 'File permissions fixed', ['fixes' => $fixes]);
        }

        return [
            'fixed' => !empty($fixes),
            'fixes' => $fixes,
            'message' => empty($fixes) ? 'All file permissions are already correct' : count($fixes) . ' file permissions updated',
        ];
    }

    /**
     * Schedule command polling if needed.
     */
    public function maybe_schedule_poll() {
        if (!wp_next_scheduled('tinyeclipse_poll_commands')) {
            wp_schedule_event(time(), 'tinyeclipse_poll_interval', 'tinyeclipse_poll_commands');
        }
    }

    /**
     * Poll and process commands via cron.
     */
    public function poll_and_process() {
        $tenant_id = tinyeclipse_get_tenant_id();
        
        // Poll for commands
        $response = wp_remote_get(TINYECLIPSE_API_BASE . "/api/commands/{$tenant_id}/poll?limit=5", [
            'timeout' => 10,
            'headers' => [
                'X-Tenant-Id' => $tenant_id,
                'User-Agent' => 'TinyEclipse-Connector/' . TINYECLIPSE_VERSION,
            ]
        ]);

        if (is_wp_error($response)) {
            tinyeclipse_log('command_queue', 'error', 'Cron poll failed', [
                'error' => $response->get_error_message()
            ]);
            return;
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (!$data || !isset($data['commands'])) {
            return;
        }

        // Process each command
        foreach ($data['commands'] as $command) {
            $result = $this->execute_command($command);
            $this->report_command_result($command['id'], $result);
            
            // Prevent timeout on too many commands
            if (microtime(true) - WP_START_TIMESTAMP > $this->max_execution_time) {
                break;
            }
        }
    }

    /**
     * Show admin notices for failed commands.
     */
    public function admin_notices() {
        $failed = get_transient('tinyeclipse_failed_commands');
        if ($failed && is_array($failed)) {
            foreach ($failed as $command) {
                ?>
                <div class="notice notice-error is-dismissible">
                    <p>
                        <strong>TinyEclipse Command Failed:</strong> 
                        <?php echo esc_html($command['command_type']); ?>
                        <br>
                        <em><?php echo esc_html($command['error_message']); ?></em>
                    </p>
                </div>
                <?php
            }
            delete_transient('tinyeclipse_failed_commands');
        }
    }
}

// Add custom cron interval
add_filter('cron_schedules', function($schedules) {
    $schedules['tinyeclipse_poll_interval'] = [
        'interval' => 60, // 1 minute
        'display' => 'TinyEclipse Command Poll Interval'
    ];
    return $schedules;
});
