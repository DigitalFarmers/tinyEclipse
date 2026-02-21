<?php
/**
 * TinyEclipse Admin
 * Admin dashboard, chat bubble, DF Helicopter, admin bar widget, settings, AJAX handlers.
 * This is the main admin UI class — all non-WC admin functionality lives here.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_Admin {
    private static $instance = null;

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', [$this, 'add_menu']);
        add_action('admin_bar_menu', [$this, 'admin_bar_widget'], 100);
        add_action('admin_footer', [$this, 'render_chat_bubble']);
        add_action('admin_footer', [$this, 'render_helicopter']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('admin_init', [$this, 'register_settings']);

        // AJAX handlers
        $ajax_actions = [
            'tinyeclipse_run_scan'       => 'manage_options',
            'tinyeclipse_save_settings'  => 'manage_options',
            'tinyeclipse_test_hub'       => 'manage_options',
            'tinyeclipse_get_logs'       => 'manage_options',
            'tinyeclipse_translate'      => 'manage_options',
            'tinyeclipse_chat'           => 'manage_woocommerce',
            'tinyeclipse_widget_data'    => 'manage_options',
            'tinyeclipse_superadmin_data'=> 'manage_options',
            'tinyeclipse_run_action'     => 'manage_options',
            'tinyeclipse_security_fix'   => 'manage_options',
            'tinyeclipse_leads_data'     => 'manage_woocommerce',
            'tinyeclipse_lead_update'    => 'manage_woocommerce',
            'tinyeclipse_request_submit' => 'manage_woocommerce',
            'tinyeclipse_requests_data'  => 'manage_woocommerce',
            'tinyeclipse_token_balance'  => 'manage_woocommerce',
            'tinyeclipse_token_top_up'   => 'manage_options',
            'tinyeclipse_token_usage'    => 'manage_woocommerce',
            'tinyeclipse_token_all_balances' => 'manage_options',
            'tinyeclipse_token_set_tier' => 'manage_options',
            'tinyeclipse_job_duplicate'  => 'manage_woocommerce',
            'tinyeclipse_job_toggle'     => 'manage_woocommerce',
            'tinyeclipse_jobs_bulk'      => 'manage_woocommerce',
        ];

        foreach ($ajax_actions as $action => $cap) {
            add_action("wp_ajax_{$action}", function () use ($action, $cap) {
                if (!current_user_can($cap)) wp_send_json_error('Unauthorized', 403);
                check_ajax_referer('tinyeclipse_nonce', 'nonce');
                $method = 'ajax_' . str_replace('tinyeclipse_', '', $action);
                if (method_exists($this, $method)) {
                    $this->$method();
                } else {
                    wp_send_json_error('Handler not found: ' . $method);
                }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // MENU
    // ═══════════════════════════════════════════════════════════════

    public function add_menu() {
        $cap = tinyeclipse_get_eclipse_cap();
        $icon = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>');

        add_menu_page('TinyEclipse', 'TinyEclipse', $cap, 'tinyeclipse', [$this, 'page_dashboard'], $icon, 30);
        add_submenu_page('tinyeclipse', 'Dashboard', 'Dashboard', $cap, 'tinyeclipse', [$this, 'page_dashboard']);
        add_submenu_page('tinyeclipse', 'Leads', 'Leads', $cap, 'tinyeclipse-leads', [$this, 'page_leads']);
        add_submenu_page('tinyeclipse', 'Requests', 'Requests', $cap, 'tinyeclipse-requests', [$this, 'page_requests']);

        // Superadmin-only pages
        if (current_user_can('manage_options')) {
            add_submenu_page('tinyeclipse', 'Security', 'Security', 'manage_options', 'tinyeclipse-security', [$this, 'page_security']);
            add_submenu_page('tinyeclipse', 'SEO', 'SEO', 'manage_options', 'tinyeclipse-seo', [$this, 'page_seo']);
            add_submenu_page('tinyeclipse', 'Mail', 'Mail', 'manage_options', 'tinyeclipse-mail', [$this, 'page_mail']);
            add_submenu_page('tinyeclipse', 'Translation', 'Translation', 'manage_options', 'tinyeclipse-translation', [$this, 'page_translation']);
            add_submenu_page('tinyeclipse', 'Jobs', 'Jobs', $cap, 'tinyeclipse-jobs', [$this, 'page_jobs']);
            add_submenu_page('tinyeclipse', 'Forms', 'Forms', 'manage_options', 'tinyeclipse-forms', [$this, 'page_forms']);
            add_submenu_page('tinyeclipse', 'Tokens', 'Tokens', 'manage_options', 'tinyeclipse-tokens', [$this, 'page_tokens']);
            add_submenu_page('tinyeclipse', 'Logs', 'Logs', 'manage_options', 'tinyeclipse-logs', [$this, 'page_logs']);
            add_submenu_page('tinyeclipse', 'Settings', 'Settings', 'manage_options', 'tinyeclipse-settings', [$this, 'page_settings']);
        }

        // Let WC/Analytics plugins add their menu items
        $extra_items = apply_filters('tinyeclipse_admin_menu_items', []);
        foreach ($extra_items as $item) {
            $item_cap = $item['cap'] ?? $cap;
            $callback = $item['callback'] ?? function () use ($item) {
                $view = $item['view'] ?? '';
                if ($view && file_exists(TINYECLIPSE_PLUGIN_DIR . 'admin/views/' . $view)) {
                    include TINYECLIPSE_PLUGIN_DIR . 'admin/views/' . $view;
                } else {
                    echo '<div class="wrap"><h1>' . esc_html($item['title']) . '</h1><p>View not found.</p></div>';
                }
            };
            add_submenu_page('tinyeclipse', $item['title'], ($item['icon'] ?? '') . ' ' . $item['title'], $item_cap, $item['slug'], $callback);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SETTINGS
    // ═══════════════════════════════════════════════════════════════

    public function register_settings() {
        $settings = [
            'tinyeclipse_site_id'            => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            'tinyeclipse_tenant_id'          => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            'tinyeclipse_hub_api_key'        => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            'tinyeclipse_hub_url'            => ['type' => 'string', 'sanitize_callback' => 'esc_url_raw'],
            'tinyeclipse_enabled'            => ['type' => 'boolean', 'default' => false],
            'tinyeclipse_color'              => ['type' => 'string', 'default' => '#6C3CE1', 'sanitize_callback' => 'sanitize_hex_color'],
            'tinyeclipse_name'               => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            'tinyeclipse_lang'               => ['type' => 'string', 'default' => 'nl', 'sanitize_callback' => 'sanitize_text_field'],
            'tinyeclipse_position'           => ['type' => 'string', 'default' => 'bottom-right', 'sanitize_callback' => 'sanitize_text_field'],
            'tinyeclipse_exclude_pages'      => ['type' => 'string', 'sanitize_callback' => 'sanitize_textarea_field'],
            'tinyeclipse_exclude_roles'      => ['type' => 'array', 'default' => ['administrator']],
            'tinyeclipse_report_email'       => ['type' => 'string', 'sanitize_callback' => 'sanitize_email'],
            'tinyeclipse_auto_report'        => ['type' => 'boolean', 'default' => true],
            'tinyeclipse_log_retention'      => ['type' => 'integer', 'default' => 30],
            'tinyeclipse_translate_key'      => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            'tinyeclipse_translate_provider' => ['type' => 'string', 'default' => 'groq', 'sanitize_callback' => 'sanitize_text_field'],
            'tinyeclipse_translate_model'    => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
        ];

        foreach ($settings as $key => $args) {
            register_setting('tinyeclipse_settings', $key, $args);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ENQUEUE ASSETS
    // ═══════════════════════════════════════════════════════════════

    public function enqueue_assets($hook) {
        if (strpos($hook, 'tinyeclipse') === false && strpos($hook, 'toplevel_page_tinyeclipse') === false) {
            // Still enqueue for admin bar + chat bubble on all admin pages
        }

        wp_localize_script('jquery', 'tinyeclipse', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('tinyeclipse_nonce'),
            'rest_url' => rest_url('tinyeclipse/v1/'),
            'hub_url'  => TINYECLIPSE_HUB_URL,
            'site_id'  => tinyeclipse_get_tenant_id(),
            'version'  => TINYECLIPSE_VERSION,
            'is_superadmin' => tinyeclipse_is_superadmin(),
            'is_shop'  => class_exists('WooCommerce'),
            'user_id'  => get_current_user_id(),
        ]);
    }

    // ═══════════════════════════════════════════════════════════════
    // ADMIN BAR WIDGET — Health indicator
    // ═══════════════════════════════════════════════════════════════

    public function admin_bar_widget($wp_admin_bar) {
        if (!current_user_can(tinyeclipse_get_eclipse_cap())) return;

        $site_id = tinyeclipse_get_tenant_id();
        $status = !empty($site_id) ? 'connected' : 'disconnected';
        $color = $status === 'connected' ? '#22c55e' : '#ef4444';
        $label = $status === 'connected' ? '🟢' : '🔴';

        $wp_admin_bar->add_node([
            'id'    => 'tinyeclipse',
            'title' => "<span style='color:{$color};font-size:10px;'>●</span> Eclipse",
            'href'  => admin_url('admin.php?page=tinyeclipse'),
            'meta'  => ['title' => 'TinyEclipse — ' . ucfirst($status)],
        ]);

        $wp_admin_bar->add_node([
            'id'     => 'tinyeclipse-dashboard',
            'parent' => 'tinyeclipse',
            'title'  => '📊 Dashboard',
            'href'   => admin_url('admin.php?page=tinyeclipse'),
        ]);

        if (tinyeclipse_is_superadmin()) {
            $wp_admin_bar->add_node([
                'id'     => 'tinyeclipse-hub',
                'parent' => 'tinyeclipse',
                'title'  => '🌐 Eclipse Hub',
                'href'   => TINYECLIPSE_HUB_URL,
                'meta'   => ['target' => '_blank'],
            ]);
            $wp_admin_bar->add_node([
                'id'     => 'tinyeclipse-security',
                'parent' => 'tinyeclipse',
                'title'  => '🔒 Security',
                'href'   => admin_url('admin.php?page=tinyeclipse-security'),
            ]);
            $wp_admin_bar->add_node([
                'id'     => 'tinyeclipse-settings',
                'parent' => 'tinyeclipse',
                'title'  => '⚙️ Settings',
                'href'   => admin_url('admin.php?page=tinyeclipse-settings'),
            ]);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // CHAT BUBBLE — Floating assistant (bottom-right)
    // ═══════════════════════════════════════════════════════════════

    public function render_chat_bubble() {
        if (!current_user_can(tinyeclipse_get_eclipse_cap())) return;

        $balance = tinyeclipse_get_token_balance();
        $bal = $balance['balance'] ?? 0;
        $tier = $balance['tier_label'] ?? $balance['tier'] ?? 'Free';
        $bal_color = $bal > 50 ? '#22c55e' : ($bal > 20 ? '#eab308' : '#ef4444');

        $is_shop = class_exists('WooCommerce');

        // Build quick actions
        $actions = [
            ['key' => 'status', 'label' => '📊 Status', 'prompt' => 'status'],
            ['key' => 'security', 'label' => '🔒 Security', 'prompt' => 'security'],
            ['key' => 'seo', 'label' => '🔍 SEO', 'prompt' => 'seo'],
            ['key' => 'help', 'label' => '❓ Help', 'prompt' => 'help'],
        ];
        $actions = apply_filters('tinyeclipse_quick_actions', $actions, $is_shop);
        ?>
        <div id="te-chat-bubble" style="position:fixed;bottom:20px;right:20px;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <!-- Toggle Button -->
            <button id="te-chat-toggle" onclick="document.getElementById('te-chat-panel').style.display=document.getElementById('te-chat-panel').style.display==='none'?'flex':'none'" style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#9333ea);border:none;cursor:pointer;box-shadow:0 4px 20px rgba(99,102,241,0.4);display:flex;align-items:center;justify-content:center;transition:transform 0.2s;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </button>

            <!-- Chat Panel -->
            <div id="te-chat-panel" style="display:none;flex-direction:column;position:absolute;bottom:70px;right:0;width:380px;max-height:520px;background:white;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.15);overflow:hidden;">
                <!-- Header -->
                <div style="background:linear-gradient(135deg,#6366f1,#9333ea);padding:16px;color:white;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-weight:600;font-size:15px;">⚡ TinyEclipse</div>
                            <div style="font-size:11px;opacity:0.8;">AI Assistant</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.2);border-radius:20px;padding:4px 10px;font-size:11px;">
                            <span style="color:<?php echo $bal_color; ?>;">🪙 <?php echo $bal; ?></span> · <?php echo esc_html($tier); ?>
                        </div>
                    </div>
                </div>

                <!-- Messages -->
                <div id="te-chat-messages" style="flex:1;overflow-y:auto;padding:16px;min-height:200px;max-height:300px;">
                    <div style="background:#f3f4f6;border-radius:12px;padding:10px 14px;margin-bottom:8px;font-size:13px;color:#374151;">
                        Hallo! Ik ben je Eclipse assistent. Type een commando of klik op een snelactie hieronder.
                    </div>
                </div>

                <!-- Quick Actions -->
                <div style="padding:8px 16px;display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid #f3f4f6;">
                    <?php foreach (array_slice($actions, 0, 6) as $action): ?>
                    <button onclick="teChatSend('<?php echo esc_js($action['prompt']); ?>')" style="background:#f3f4f6;border:none;border-radius:20px;padding:5px 12px;font-size:11px;cursor:pointer;white-space:nowrap;"><?php echo esc_html($action['label']); ?></button>
                    <?php endforeach; ?>
                </div>

                <!-- Input -->
                <div style="padding:12px 16px;border-top:1px solid #e5e7eb;">
                    <div style="display:flex;gap:8px;">
                        <input id="te-chat-input" type="text" placeholder="Type een commando..." onkeydown="if(event.key==='Enter')teChatSend(this.value)" style="flex:1;border:1px solid #e5e7eb;border-radius:10px;padding:8px 12px;font-size:13px;outline:none;" />
                        <button onclick="teChatSend(document.getElementById('te-chat-input').value)" style="background:#6366f1;color:white;border:none;border-radius:10px;padding:8px 14px;cursor:pointer;font-size:13px;">→</button>
                    </div>
                </div>
            </div>
        </div>

        <script>
        function teChatSend(msg) {
            if (!msg || !msg.trim()) return;
            var input = document.getElementById('te-chat-input');
            var messages = document.getElementById('te-chat-messages');
            input.value = '';

            // User message
            messages.innerHTML += '<div style="background:#6366f1;color:white;border-radius:12px;padding:10px 14px;margin-bottom:8px;font-size:13px;margin-left:40px;">' + msg.replace(/</g,'&lt;') + '</div>';
            messages.scrollTop = messages.scrollHeight;

            // Loading
            var loadId = 'te-load-' + Date.now();
            messages.innerHTML += '<div id="' + loadId + '" style="background:#f3f4f6;border-radius:12px;padding:10px 14px;margin-bottom:8px;font-size:13px;color:#9ca3af;">Bezig...</div>';
            messages.scrollTop = messages.scrollHeight;

            jQuery.post(tinyeclipse.ajax_url, {
                action: 'tinyeclipse_chat',
                nonce: tinyeclipse.nonce,
                message: msg
            }, function(res) {
                var el = document.getElementById(loadId);
                if (el) {
                    if (res.success) {
                        el.style.color = '#374151';
                        el.innerHTML = res.data.reply || res.data.message || 'OK';
                        // Update token badge
                        if (res.data.balance !== undefined) {
                            var badge = document.querySelector('#te-chat-panel [style*="🪙"]');
                            // Simple balance update in header would go here
                        }
                    } else {
                        el.style.color = '#ef4444';
                        el.innerHTML = '❌ ' + (res.data || 'Fout');
                    }
                }
                messages.scrollTop = messages.scrollHeight;
            }).fail(function() {
                var el = document.getElementById(loadId);
                if (el) { el.style.color = '#ef4444'; el.innerHTML = '❌ Verbinding mislukt'; }
            });
        }
        </script>
        <?php
    }

    // ═══════════════════════════════════════════════════════════════
    // DF HELICOPTER — Full-screen command center (superadmin only)
    // ═══════════════════════════════════════════════════════════════

    public function render_helicopter() {
        if (!tinyeclipse_is_superadmin()) return;

        $stats = [
            'version'     => TINYECLIPSE_VERSION,
            'environment' => tinyeclipse_is_staging() ? 'staging' : 'production',
            'site'        => get_bloginfo('name'),
            'users'       => count_users()['total_users'] ?? 0,
            'pages'       => wp_count_posts('page')->publish,
            'posts'       => wp_count_posts('post')->publish,
        ];
        $stats = apply_filters('tinyeclipse_helicopter_stats', $stats);
        ?>
        <div id="te-helicopter" style="display:none;position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.95);color:white;font-family:'SF Mono',Monaco,monospace;overflow-y:auto;">
            <div style="max-width:1200px;margin:0 auto;padding:40px 20px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;">
                    <div>
                        <h1 style="margin:0;font-size:24px;color:#a78bfa;">⚡ DF Helicopter</h1>
                        <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">TinyEclipse Command Center — <?php echo esc_html(get_site_url()); ?></p>
                    </div>
                    <button onclick="document.getElementById('te-helicopter').style.display='none'" style="background:none;border:1px solid #4b5563;color:#9ca3af;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;">ESC Close</button>
                </div>

                <!-- Stats Grid -->
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:30px;">
                    <?php foreach ($stats as $label => $value): ?>
                    <div style="background:#1f2937;border-radius:10px;padding:16px;">
                        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;"><?php echo esc_html($label); ?></div>
                        <div style="font-size:20px;font-weight:600;color:#e5e7eb;margin-top:4px;"><?php echo esc_html($value); ?></div>
                    </div>
                    <?php endforeach; ?>
                </div>

                <!-- Quick Links -->
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <a href="<?php echo esc_url(TINYECLIPSE_HUB_URL); ?>" target="_blank" style="background:#6366f1;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;">🌐 Eclipse Hub</a>
                    <a href="<?php echo admin_url('admin.php?page=tinyeclipse-security'); ?>" style="background:#1f2937;color:#e5e7eb;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;">🔒 Security</a>
                    <a href="<?php echo admin_url('admin.php?page=tinyeclipse-settings'); ?>" style="background:#1f2937;color:#e5e7eb;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;">⚙️ Settings</a>
                    <a href="<?php echo admin_url('admin.php?page=tinyeclipse-logs'); ?>" style="background:#1f2937;color:#e5e7eb;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;">📋 Logs</a>
                    <a href="<?php echo admin_url('admin.php?page=tinyeclipse-tokens'); ?>" style="background:#1f2937;color:#e5e7eb;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;">🪙 Tokens</a>
                </div>
            </div>
        </div>

        <script>
        document.addEventListener('keydown', function(e) {
            // Ctrl+Shift+H to toggle helicopter
            if (e.ctrlKey && e.shiftKey && e.key === 'H') {
                e.preventDefault();
                var heli = document.getElementById('te-helicopter');
                heli.style.display = heli.style.display === 'none' ? 'block' : 'none';
            }
            // ESC to close
            if (e.key === 'Escape') {
                document.getElementById('te-helicopter').style.display = 'none';
            }
        });
        </script>
        <?php
    }

    // ═══════════════════════════════════════════════════════════════
    // AJAX HANDLERS
    // ═══════════════════════════════════════════════════════════════

    public function ajax_chat() {
        $message = sanitize_text_field($_POST['message'] ?? '');
        if (empty($message)) wp_send_json_error('Empty message');

        $user_id = get_current_user_id();

        // Token check
        if (!TinyEclipse_Tokens::instance()->can_afford('chat', $user_id)) {
            wp_send_json_error('Onvoldoende tokens. Upgrade je plan voor meer tokens.');
        }

        $reply = $this->process_chat_command($message);

        // Deduct token
        $deduction = tinyeclipse_deduct_tokens('chat', $user_id);
        $balance = is_wp_error($deduction) ? 0 : ($deduction['balance'] ?? 0);

        do_action('tinyeclipse_chat_response', $reply, $message, $user_id);

        wp_send_json_success([
            'reply'   => $reply,
            'balance' => $balance,
            'command' => $message,
        ]);
    }

    /**
     * Process chat command — keyword matching + plugin extensions.
     */
    private function process_chat_command($message) {
        $msg = strtolower(trim($message));

        // Built-in commands
        $commands = [
            'status'      => ['keywords' => ['status', 'health', 'gezondheid', 'overzicht'], 'callback' => [$this, 'chat_status']],
            'security'    => ['keywords' => ['security', 'beveiliging', 'veiligheid', 'hack'], 'callback' => [$this, 'chat_security']],
            'seo'         => ['keywords' => ['seo', 'zoekmachine', 'google', 'ranking'], 'callback' => [$this, 'chat_seo']],
            'mail'        => ['keywords' => ['mail', 'smtp', 'email', 'e-mail'], 'callback' => [$this, 'chat_mail']],
            'translation' => ['keywords' => ['vertaling', 'translation', 'wpml', 'taal', 'language'], 'callback' => [$this, 'chat_translation']],
            'jobs'        => ['keywords' => ['vacature', 'job', 'sollicitatie', 'recruitment'], 'callback' => [$this, 'chat_jobs']],
            'forms'       => ['keywords' => ['formulier', 'form', 'inzending', 'submission'], 'callback' => [$this, 'chat_forms']],
            'leads'       => ['keywords' => ['lead', 'contact', 'prospect'], 'callback' => [$this, 'chat_leads']],
            'requests'    => ['keywords' => ['request', 'verzoek', 'aanvraag'], 'callback' => [$this, 'chat_requests']],
            'tokens'      => ['keywords' => ['token', 'saldo', 'balance', 'tegoed', 'plan'], 'callback' => [$this, 'chat_tokens']],
            'help'        => ['keywords' => ['help', 'hulp', 'commando', 'commands'], 'callback' => [$this, 'chat_help']],
        ];

        // Let WC/Analytics plugins register extra commands
        $commands = apply_filters('tinyeclipse_chat_commands', $commands);

        // Match keywords
        foreach ($commands as $key => $cmd) {
            foreach ($cmd['keywords'] as $kw) {
                if (strpos($msg, $kw) !== false) {
                    return call_user_func($cmd['callback'], $message);
                }
            }
        }

        // Fallback
        return $this->chat_status($message);
    }

    private function chat_status($msg = '') {
        $site = get_bloginfo('name');
        $env = tinyeclipse_is_staging() ? '🟡 Staging' : '🟢 Production';
        $plugins = count(get_option('active_plugins', []));
        $pages = wp_count_posts('page')->publish;
        $posts = wp_count_posts('post')->publish;
        $users = count_users()['total_users'] ?? 0;

        return "<strong>{$site}</strong> — {$env}<br>"
            . "📦 {$plugins} plugins · 📄 {$pages} pagina's · 📝 {$posts} berichten · 👥 {$users} gebruikers<br>"
            . "🔌 TinyEclipse v" . TINYECLIPSE_VERSION;
    }

    private function chat_security($msg = '') {
        $audit = TinyEclipse_Security::instance()->audit();
        $icon = $audit['score'] >= 80 ? '🟢' : ($audit['score'] >= 50 ? '🟡' : '🔴');
        $result = "{$icon} <strong>Security Score: {$audit['score']}%</strong> ({$audit['passed']}/{$audit['total']} checks)<br>";
        foreach ($audit['checks'] as $key => $check) {
            $s = $check['status'] === 'pass' ? '✅' : ($check['status'] === 'warn' ? '⚠️' : '❌');
            $result .= "{$s} {$check['label']}: {$check['detail']}<br>";
        }
        return $result;
    }

    private function chat_seo($msg = '') {
        $audit = TinyEclipse_SEO::instance()->audit();
        $icon = $audit['score'] >= 80 ? '🟢' : ($audit['score'] >= 50 ? '🟡' : '🔴');
        return "{$icon} <strong>SEO Score: {$audit['score']}%</strong> ({$audit['passed']}/{$audit['total']} checks)<br>"
            . "Plugin: " . ($audit['seo_plugin'] ?? 'Geen') . "<br>"
            . "Bekijk details: <a href='" . admin_url('admin.php?page=tinyeclipse-seo') . "'>SEO pagina</a>";
    }

    private function chat_mail($msg = '') {
        $status = TinyEclipse_Mail::instance()->get_status();
        $icon = $status['smtp_active'] ? '✅' : '❌';
        return "{$icon} <strong>Mail Status</strong><br>"
            . "SMTP: " . ($status['smtp_plugin'] ?? 'Niet geconfigureerd') . "<br>"
            . "Admin email: " . ($status['admin_email'] ?? '-') . "<br>"
            . "Score: " . ($status['score'] ?? 0) . "%";
    }

    private function chat_translation($msg = '') {
        $audit = TinyEclipse_Translation::instance()->audit();
        if (!$audit['active']) return "❌ WPML is niet geïnstalleerd.";
        return "🌐 <strong>Vertalingen</strong><br>"
            . "Talen: {$audit['language_count']} · Dekking: {$audit['overall_coverage']}%<br>"
            . "Ontbrekend: {$audit['missing_count']} · Incompleet: {$audit['incomplete_count']}";
    }

    private function chat_jobs($msg = '') {
        $audit = TinyEclipse_Jobs::instance()->audit();
        if (!$audit['active']) return "❌ WP Job Manager is niet geïnstalleerd.";
        return "💼 <strong>Vacatures</strong><br>"
            . "Actief: {$audit['active_jobs']} · Verlopen: {$audit['expired_jobs']} · Sollicitaties: {$audit['total_applications']}";
    }

    private function chat_forms($msg = '') {
        $audit = TinyEclipse_Forms::instance()->audit();
        if (!$audit['active']) return "❌ Geen formulier plugin gevonden.";
        return "📋 <strong>Formulieren</strong><br>"
            . "Providers: " . implode(', ', $audit['providers']) . "<br>"
            . "Formulieren: {$audit['total_forms']} · Inzendingen: {$audit['total_submissions']}";
    }

    private function chat_leads($msg = '') { return "📬 Bekijk leads: <a href='" . admin_url('admin.php?page=tinyeclipse-leads') . "'>Leads pagina</a>"; }
    private function chat_requests($msg = '') { return "📩 Bekijk verzoeken: <a href='" . admin_url('admin.php?page=tinyeclipse-requests') . "'>Requests pagina</a>"; }

    private function chat_tokens($msg = '') {
        $balance = tinyeclipse_get_token_balance();
        $tier = $balance['tier_label'] ?? $balance['tier'] ?? 'Free';
        $monthly = $balance['monthly_tokens'] ?? 0;
        return "🪙 <strong>Token Saldo</strong><br>"
            . "Saldo: <strong>{$balance['balance']}</strong> tokens<br>"
            . "Plan: {$tier} ({$monthly}/maand)<br>"
            . "Totaal gebruikt: {$balance['lifetime_used']}";
    }

    private function chat_help($msg = '') {
        $cmds = "📖 <strong>Beschikbare commando's:</strong><br>"
            . "• <code>status</code> — Site overzicht<br>"
            . "• <code>security</code> — Beveiligingsaudit<br>"
            . "• <code>seo</code> — SEO audit<br>"
            . "• <code>mail</code> — Mail/SMTP status<br>"
            . "• <code>translation</code> — Vertaalstatus<br>"
            . "• <code>jobs</code> — Vacatures<br>"
            . "• <code>forms</code> — Formulieren<br>"
            . "• <code>tokens</code> — Token saldo<br>"
            . "• <code>help</code> — Dit overzicht<br>";

        // Let plugins add their commands to help
        $extra = apply_filters('tinyeclipse_chat_commands', []);
        foreach ($extra as $key => $cmd) {
            if (!in_array($key, ['status', 'security', 'seo', 'mail', 'translation', 'jobs', 'forms', 'leads', 'requests', 'tokens', 'help'])) {
                $cmds .= "• <code>{$key}</code> — " . ($cmd['keywords'][0] ?? $key) . "<br>";
            }
        }
        return $cmds;
    }

    // ═══════════════════════════════════════════════════════════════
    // OTHER AJAX HANDLERS
    // ═══════════════════════════════════════════════════════════════

    public function ajax_run_scan() {
        $result = TinyEclipse_Collector::instance()->run_hourly_scan();
        wp_send_json_success($result);
    }

    public function ajax_save_settings() {
        $settings = $_POST['settings'] ?? [];
        if (is_array($settings)) {
            foreach ($settings as $key => $value) {
                if (strpos($key, 'tinyeclipse_') === 0) {
                    update_option(sanitize_text_field($key), sanitize_text_field($value));
                }
            }
        }
        do_action('tinyeclipse_settings_saved', $settings);
        wp_send_json_success('Settings saved');
    }

    public function ajax_test_hub() {
        $site_id = tinyeclipse_get_tenant_id();
        if (empty($site_id)) wp_send_json_error('No site ID configured');
        $result = TinyEclipse_Hub::instance()->onboard();
        wp_send_json_success($result);
    }

    public function ajax_get_logs() {
        global $wpdb;
        $table = $wpdb->prefix . 'tinyeclipse_logs';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) wp_send_json_success([]);
        $limit = min((int)($_POST['limit'] ?? 100), 500);
        $logs = $wpdb->get_results("SELECT * FROM {$table} ORDER BY id DESC LIMIT {$limit}", ARRAY_A);
        wp_send_json_success($logs);
    }

    public function ajax_translate() {
        $post_id = (int)($_POST['post_id'] ?? 0);
        $lang = sanitize_text_field($_POST['language'] ?? '');
        if (!$post_id || !$lang) wp_send_json_error('Missing post_id or language');
        $result = TinyEclipse_Translator::instance()->translate_single($post_id, $lang);
        if (is_wp_error($result)) wp_send_json_error($result->get_error_message());
        wp_send_json_success($result);
    }

    public function ajax_widget_data() {
        $snapshot = TinyEclipse_Collector::instance()->get_snapshot();
        wp_send_json_success($snapshot);
    }

    public function ajax_superadmin_data() {
        if (!tinyeclipse_is_superadmin()) wp_send_json_error('Not superadmin');
        $data = [
            'snapshot' => TinyEclipse_Collector::instance()->get_snapshot(),
            'tokens'   => TinyEclipse_Tokens::instance()->get_all_balances(),
        ];
        wp_send_json_success($data);
    }

    public function ajax_run_action() {
        $action_type = sanitize_text_field($_POST['action_type'] ?? '');
        switch ($action_type) {
            case 'scan': $result = TinyEclipse_Collector::instance()->run_hourly_scan(); break;
            case 'report': $result = TinyEclipse_Collector::instance()->run_daily_report(); break;
            case 'heartbeat': TinyEclipse_Hub::instance()->maybe_heartbeat(); $result = ['sent' => true]; break;
            default: $result = ['error' => 'Unknown action'];
        }
        wp_send_json_success($result);
    }

    public function ajax_security_fix() {
        $fix_type = sanitize_text_field($_POST['fix_type'] ?? '');
        $result = TinyEclipse_Security::instance()->apply_fix($fix_type);
        wp_send_json_success($result);
    }

    public function ajax_leads_data() { wp_send_json_success(['message' => 'Leads data via Hub API']); }
    public function ajax_lead_update() { wp_send_json_success(['message' => 'Lead updated']); }
    public function ajax_request_submit() { wp_send_json_success(['message' => 'Request submitted']); }
    public function ajax_requests_data() { wp_send_json_success(['message' => 'Requests data']); }

    public function ajax_token_balance() {
        $user_id = (int)($_POST['user_id'] ?? get_current_user_id());
        wp_send_json_success(tinyeclipse_get_token_balance($user_id));
    }

    public function ajax_token_top_up() {
        if (!tinyeclipse_is_superadmin()) wp_send_json_error('Not authorized');
        $user_id = (int)($_POST['user_id'] ?? 0);
        $amount = (int)($_POST['amount'] ?? 0);
        if (!$user_id || !$amount) wp_send_json_error('Missing user_id or amount');
        $result = TinyEclipse_Tokens::instance()->top_up($user_id, $amount);
        if (is_wp_error($result)) wp_send_json_error($result->get_error_message());
        wp_send_json_success($result);
    }

    public function ajax_token_usage() {
        $user_id = (int)($_POST['user_id'] ?? get_current_user_id());
        wp_send_json_success(TinyEclipse_Tokens::instance()->get_usage($user_id));
    }

    public function ajax_token_all_balances() {
        if (!tinyeclipse_is_superadmin()) wp_send_json_error('Not authorized');
        wp_send_json_success(TinyEclipse_Tokens::instance()->get_all_balances());
    }

    public function ajax_token_set_tier() {
        if (!tinyeclipse_is_superadmin()) wp_send_json_error('Not authorized');
        $user_id = (int)($_POST['user_id'] ?? 0);
        $tier = sanitize_text_field($_POST['tier'] ?? '');
        if (!$user_id || !$tier) wp_send_json_error('Missing user_id or tier');
        $result = TinyEclipse_Tokens::instance()->set_tier($user_id, $tier);
        if (is_wp_error($result)) wp_send_json_error($result->get_error_message());
        wp_send_json_success($result);
    }

    public function ajax_job_duplicate() {
        $job_id = (int)($_POST['job_id'] ?? 0);
        if (!$job_id) wp_send_json_error('Missing job_id');
        $result = TinyEclipse_Jobs::instance()->duplicate_job($job_id);
        if (is_wp_error($result)) wp_send_json_error($result->get_error_message());
        wp_send_json_success($result);
    }

    public function ajax_job_toggle() {
        $job_id = (int)($_POST['job_id'] ?? 0);
        $action = sanitize_text_field($_POST['toggle_action'] ?? '');
        if (!$job_id) wp_send_json_error('Missing job_id');
        if ($action === 'close') $result = TinyEclipse_Jobs::instance()->close_job($job_id);
        elseif ($action === 'publish') $result = TinyEclipse_Jobs::instance()->publish_job($job_id);
        else wp_send_json_error('Unknown toggle action');
        if (is_wp_error($result)) wp_send_json_error($result->get_error_message());
        wp_send_json_success($result);
    }

    public function ajax_jobs_bulk() {
        $job_ids = array_map('intval', $_POST['job_ids'] ?? []);
        $action = sanitize_text_field($_POST['bulk_action'] ?? '');
        $results = [];
        foreach ($job_ids as $id) {
            if ($action === 'close') $results[] = TinyEclipse_Jobs::instance()->close_job($id);
            elseif ($action === 'publish') $results[] = TinyEclipse_Jobs::instance()->publish_job($id);
        }
        wp_send_json_success($results);
    }

    // ═══════════════════════════════════════════════════════════════
    // PAGE RENDERERS — Load admin views
    // ═══════════════════════════════════════════════════════════════

    private function load_view($view) {
        $file = TINYECLIPSE_PLUGIN_DIR . 'admin/views/' . $view . '.php';
        if (file_exists($file)) {
            include $file;
        } else {
            echo '<div class="wrap"><h1>TinyEclipse — ' . esc_html(ucfirst($view)) . '</h1>';
            echo '<p>View wordt geladen vanuit Eclipse Hub. <a href="' . esc_url(TINYECLIPSE_HUB_URL) . '" target="_blank">Open Eclipse Hub →</a></p></div>';
        }
    }

    public function page_dashboard() { $this->load_view('dashboard'); }
    public function page_leads() { $this->load_view('leads'); }
    public function page_requests() { $this->load_view('requests'); }
    public function page_security() { $this->load_view('security'); }
    public function page_seo() { $this->load_view('seo'); }
    public function page_mail() { $this->load_view('mail'); }
    public function page_translation() { $this->load_view('translation'); }
    public function page_jobs() { $this->load_view('jobs'); }
    public function page_forms() { $this->load_view('forms'); }
    public function page_tokens() { $this->load_view('tokens'); }
    public function page_logs() { $this->load_view('logs'); }
    public function page_settings() { $this->load_view('settings'); }

    // ═══════════════════════════════════════════════════════════════
    // FRONTEND WIDGET INJECTION
    // ═══════════════════════════════════════════════════════════════

    public static function inject_frontend_widget() {
        if (is_admin()) return;
        if (!get_option('tinyeclipse_enabled', false)) return;

        $tenant_id = tinyeclipse_get_tenant_id();
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
    }
}

// Frontend widget injection (runs outside admin)
add_action('wp_footer', ['TinyEclipse_Admin', 'inject_frontend_widget'], 999);
