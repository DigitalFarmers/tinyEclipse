<?php
/**
 * Plugin Name: TinyEclipse Analytics
 * Plugin URI: https://tinyeclipse.digitalfarmers.be
 * Description: Visitor Analytics & Intelligence for TinyEclipse — Sessions, Pageviews, Scroll Depth, Click Tracking, Exit Intent & Conversion Funnels by Digital Farmers.
 * Version: 1.0.0
 * Author: Digital Farmers
 * Author URI: https://digitalfarmers.be
 * License: GPL v2 or later
 * Text Domain: tinyeclipse-analytics
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Requires Plugins: tinyeclipse-connector
 */

if (!defined('ABSPATH')) exit;

define('TINYECLIPSE_ANALYTICS_VERSION', '1.0.0');
define('TINYECLIPSE_ANALYTICS_DIR', plugin_dir_path(__FILE__));
define('TINYECLIPSE_ANALYTICS_URL', plugin_dir_url(__FILE__));

// ─── Dependency Check ───
add_action('admin_init', function () {
    if (!function_exists('tinyeclipse_send_event')) {
        deactivate_plugins(plugin_basename(__FILE__));
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p><strong>TinyEclipse Analytics</strong> vereist de <strong>TinyEclipse Connector</strong> plugin. Installeer en activeer deze eerst.</p></div>';
        });
        return;
    }
});

// ═══════════════════════════════════════════════════════════════
// FRONTEND TRACKER — Privacy-friendly inline JS (~2KB)
// No cookies, hashed IP, respects DNT, session storage only
// ═══════════════════════════════════════════════════════════════

add_action('wp_footer', function () {
    if (is_admin()) return;
    if (!function_exists('tinyeclipse_get_tenant_id')) return;

    $tenant_id = tinyeclipse_get_tenant_id();
    if (empty($tenant_id)) return;

    // Respect Do Not Track header
    if (isset($_SERVER['HTTP_DNT']) && $_SERVER['HTTP_DNT'] === '1') return;

    // Check excluded roles (reuse core setting)
    if (is_user_logged_in()) {
        $user = wp_get_current_user();
        $exclude_roles = get_option('tinyeclipse_exclude_roles', ['administrator']);
        if (array_intersect($user->roles, (array)$exclude_roles)) return;
    }

    // Check excluded pages (reuse core setting)
    $exclude_pages = get_option('tinyeclipse_exclude_pages', '');
    if (!empty($exclude_pages)) {
        $current_path = wp_parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $excluded = array_filter(array_map('trim', explode("\n", $exclude_pages)));
        foreach ($excluded as $path) {
            if ($path && strpos($current_path, $path) === 0) return;
        }
    }

    $api_base = defined('TINYECLIPSE_API_BASE') ? TINYECLIPSE_API_BASE : 'https://api.tinyeclipse.digitalfarmers.be';
    $rest_url = rest_url('tinyeclipse/v1/analytics/collect');

    // Inline lightweight tracker (~2KB minified)
    ?>
    <script>
    (function(){
        'use strict';
        if (navigator.doNotTrack === '1') return;
        var T = '<?php echo esc_js($tenant_id); ?>';
        var API = '<?php echo esc_js($api_base); ?>';
        var LOCAL = '<?php echo esc_js($rest_url); ?>';
        var sid = sessionStorage.getItem('te_sid');
        if (!sid) { sid = 'te_' + Math.random().toString(36).substr(2,12) + Date.now().toString(36); sessionStorage.setItem('te_sid', sid); }
        var vid = localStorage.getItem('te_vid');
        if (!vid) { vid = 'tv_' + Math.random().toString(36).substr(2,12) + Date.now().toString(36); localStorage.setItem('te_vid', vid); }

        var startTime = Date.now();
        var maxScroll = 0;
        var clicks = 0;
        var isNew = !sessionStorage.getItem('te_returning');
        sessionStorage.setItem('te_returning', '1');

        // Track scroll depth (passive, non-blocking)
        window.addEventListener('scroll', function() {
            var h = document.documentElement.scrollHeight - window.innerHeight;
            if (h > 0) { var pct = Math.round((window.scrollY / h) * 100); if (pct > maxScroll) maxScroll = pct; }
        }, {passive: true});

        // Track clicks
        document.addEventListener('click', function() { clicks++; });

        // Detect exit intent (desktop only)
        if (window.innerWidth > 768) {
            document.addEventListener('mouseout', function(e) {
                if (e.clientY < 5 && !window._teExitSent) {
                    window._teExitSent = true;
                    send('exit_intent', {scroll: maxScroll, time: Math.round((Date.now()-startTime)/1000)});
                }
            });
        }

        // Send pageview on load
        send('pageview', {
            url: location.href,
            path: location.pathname,
            title: document.title,
            referrer: document.referrer,
            screen_w: screen.width,
            screen_h: screen.height,
            lang: navigator.language,
            is_new: isNew,
            utm_source: gp('utm_source'),
            utm_medium: gp('utm_medium'),
            utm_campaign: gp('utm_campaign'),
            utm_term: gp('utm_term'),
            utm_content: gp('utm_content')
        });

        // Send engagement on unload (Beacon API — non-blocking)
        window.addEventListener('pagehide', function() {
            send('engagement', {
                path: location.pathname,
                time_on_page: Math.round((Date.now()-startTime)/1000),
                scroll_depth: maxScroll,
                clicks: clicks
            });
        });

        // Rage click detection (5+ clicks in 2s on same area)
        var cl = [];
        document.addEventListener('click', function(e) {
            var now = Date.now();
            cl.push({x: e.clientX, y: e.clientY, t: now});
            cl = cl.filter(function(c) { return now - c.t < 2000; });
            if (cl.length >= 5) {
                var area = cl.every(function(c) { return Math.abs(c.x - cl[0].x) < 50 && Math.abs(c.y - cl[0].y) < 50; });
                if (area && !window._teRageSent) {
                    window._teRageSent = true;
                    send('rage_click', {
                        path: location.pathname,
                        element: e.target.tagName + (e.target.className ? '.' + e.target.className.split(' ')[0] : ''),
                        x: e.clientX, y: e.clientY
                    });
                }
            }
        });

        function send(event_type, data) {
            data.tenant_id = T;
            data.session_id = sid;
            data.visitor_id = vid;
            data.event_type = event_type;
            data.timestamp = new Date().toISOString();
            var payload = JSON.stringify(data);
            // Try local WP REST first (for local DB storage), then Hub API
            if (navigator.sendBeacon) {
                navigator.sendBeacon(LOCAL, payload);
                navigator.sendBeacon(API + '/api/tracking/event', payload);
            } else {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', API + '/api/tracking/event', true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.send(payload);
            }
        }

        function gp(n) {
            var r = new RegExp('[?&]' + n + '=([^&#]*)');
            var m = r.exec(location.search);
            return m ? decodeURIComponent(m[1]) : '';
        }
    })();
    </script>
    <?php
}, 998); // Before widget (999)

// ═══════════════════════════════════════════════════════════════
// LOCAL EVENT COLLECTION — Store events in WP DB
// ═══════════════════════════════════════════════════════════════

add_action('rest_api_init', function () {

    // Collect event (public — called by tracker JS)
    register_rest_route('tinyeclipse/v1', '/analytics/collect', [
        'methods' => 'POST',
        'callback' => function ($request) {
            $body = $request->get_body();
            $data = json_decode($body, true);
            if (empty($data) || empty($data['event_type'])) {
                return new WP_REST_Response(['error' => 'Invalid event'], 400);
            }

            // Verify tenant
            $stored_tenant = function_exists('tinyeclipse_get_tenant_id') ? tinyeclipse_get_tenant_id() : '';
            if (!empty($stored_tenant) && ($data['tenant_id'] ?? '') !== $stored_tenant) {
                return new WP_REST_Response(['error' => 'Invalid tenant'], 403);
            }

            // Hash IP for privacy (GDPR)
            $ip_raw = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
            $ip_hash = hash('sha256', $ip_raw . date('Y-m-d') . ($stored_tenant ?: 'salt'));

            global $wpdb;
            $table = $wpdb->prefix . 'tinyeclipse_analytics';
            if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) {
                return new WP_REST_Response(['status' => 'no_table'], 200);
            }

            $wpdb->insert($table, [
                'tenant_id'   => sanitize_text_field($data['tenant_id'] ?? ''),
                'session_id'  => sanitize_text_field($data['session_id'] ?? ''),
                'visitor_id'  => sanitize_text_field($data['visitor_id'] ?? ''),
                'event_type'  => sanitize_text_field($data['event_type']),
                'page_url'    => esc_url_raw($data['url'] ?? $data['path'] ?? ''),
                'page_path'   => sanitize_text_field($data['path'] ?? ''),
                'page_title'  => sanitize_text_field($data['title'] ?? ''),
                'referrer'    => esc_url_raw($data['referrer'] ?? ''),
                'utm_source'  => sanitize_text_field($data['utm_source'] ?? ''),
                'utm_medium'  => sanitize_text_field($data['utm_medium'] ?? ''),
                'utm_campaign'=> sanitize_text_field($data['utm_campaign'] ?? ''),
                'utm_term'    => sanitize_text_field($data['utm_term'] ?? ''),
                'utm_content' => sanitize_text_field($data['utm_content'] ?? ''),
                'screen_w'    => (int)($data['screen_w'] ?? 0),
                'screen_h'    => (int)($data['screen_h'] ?? 0),
                'scroll_depth'=> (int)($data['scroll_depth'] ?? $data['scroll'] ?? 0),
                'time_on_page'=> (int)($data['time_on_page'] ?? $data['time'] ?? 0),
                'clicks'      => (int)($data['clicks'] ?? 0),
                'language'    => sanitize_text_field($data['lang'] ?? ''),
                'ip_hash'     => $ip_hash,
                'user_agent'  => sanitize_text_field(substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500)),
                'is_new'      => (int)($data['is_new'] ?? 0),
                'extra'       => wp_json_encode(array_diff_key($data, array_flip([
                    'tenant_id','session_id','visitor_id','event_type','url','path','title',
                    'referrer','utm_source','utm_medium','utm_campaign','utm_term','utm_content',
                    'screen_w','screen_h','scroll_depth','scroll','time_on_page','time','clicks',
                    'lang','is_new','timestamp'
                ]))),
                'created_at'  => current_time('mysql'),
            ]);

            return new WP_REST_Response(['status' => 'ok'], 200);
        },
        'permission_callback' => '__return_true', // Public endpoint — tracker JS calls this
    ]);

    // ─── Analytics config (authenticated) ───
    register_rest_route('tinyeclipse/v1', '/analytics/config', [
        'methods' => 'GET',
        'callback' => function () {
            return new WP_REST_Response([
                'active'  => true,
                'version' => TINYECLIPSE_ANALYTICS_VERSION,
                'tracking_enabled' => true,
                'respect_dnt' => true,
                'no_cookies'  => true,
                'site_url'    => get_site_url(),
            ], 200);
        },
        'permission_callback' => function ($request) {
            return function_exists('tinyeclipse_verify_request') ? tinyeclipse_verify_request($request) : false;
        },
    ]);

    // ─── Analytics stats (authenticated) ───
    register_rest_route('tinyeclipse/v1', '/analytics/stats', [
        'methods' => 'GET',
        'callback' => function ($request) {
            global $wpdb;
            $table = $wpdb->prefix . 'tinyeclipse_analytics';
            if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) {
                return new WP_REST_Response(['active' => false, 'message' => 'Analytics table not found'], 200);
            }

            $days = min((int)($request->get_param('days') ?: 7), 90);
            $since = date('Y-m-d H:i:s', strtotime("-{$days} days"));

            $pageviews = (int)$wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s", $since
            ));
            $sessions = (int)$wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(DISTINCT session_id) FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s", $since
            ));
            $visitors = (int)$wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(DISTINCT visitor_id) FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s", $since
            ));
            $new_visitors = (int)$wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE event_type = 'pageview' AND is_new = 1 AND created_at >= %s", $since
            ));
            $avg_scroll = (float)$wpdb->get_var($wpdb->prepare(
                "SELECT AVG(scroll_depth) FROM {$table} WHERE event_type = 'engagement' AND scroll_depth > 0 AND created_at >= %s", $since
            ));
            $avg_time = (float)$wpdb->get_var($wpdb->prepare(
                "SELECT AVG(time_on_page) FROM {$table} WHERE event_type = 'engagement' AND time_on_page > 0 AND created_at >= %s", $since
            ));
            $exit_intents = (int)$wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE event_type = 'exit_intent' AND created_at >= %s", $since
            ));
            $rage_clicks = (int)$wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE event_type = 'rage_click' AND created_at >= %s", $since
            ));

            // Top pages
            $top_pages = $wpdb->get_results($wpdb->prepare(
                "SELECT page_path, page_title, COUNT(*) as views, COUNT(DISTINCT session_id) as sessions
                 FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s
                 GROUP BY page_path ORDER BY views DESC LIMIT 20", $since
            ), ARRAY_A);

            // Top referrers
            $top_referrers = $wpdb->get_results($wpdb->prepare(
                "SELECT referrer, COUNT(*) as count FROM {$table}
                 WHERE event_type = 'pageview' AND referrer != '' AND created_at >= %s
                 GROUP BY referrer ORDER BY count DESC LIMIT 10", $since
            ), ARRAY_A);

            // UTM sources
            $utm_sources = $wpdb->get_results($wpdb->prepare(
                "SELECT utm_source, utm_medium, utm_campaign, COUNT(*) as count
                 FROM {$table} WHERE event_type = 'pageview' AND utm_source != '' AND created_at >= %s
                 GROUP BY utm_source, utm_medium, utm_campaign ORDER BY count DESC LIMIT 10", $since
            ), ARRAY_A);

            // Daily pageviews
            $daily = $wpdb->get_results($wpdb->prepare(
                "SELECT DATE(created_at) as date, COUNT(*) as pageviews, COUNT(DISTINCT session_id) as sessions
                 FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s
                 GROUP BY DATE(created_at) ORDER BY date ASC", $since
            ), ARRAY_A);

            // Device breakdown
            $devices = $wpdb->get_results($wpdb->prepare(
                "SELECT CASE WHEN screen_w < 768 THEN 'mobile' WHEN screen_w < 1024 THEN 'tablet' ELSE 'desktop' END as device,
                        COUNT(*) as count
                 FROM {$table} WHERE event_type = 'pageview' AND screen_w > 0 AND created_at >= %s
                 GROUP BY device ORDER BY count DESC", $since
            ), ARRAY_A);

            return new WP_REST_Response([
                'active'        => true,
                'period_days'   => $days,
                'pageviews'     => $pageviews,
                'sessions'      => $sessions,
                'visitors'      => $visitors,
                'new_visitors'  => $new_visitors,
                'avg_scroll'    => round($avg_scroll),
                'avg_time'      => round($avg_time),
                'exit_intents'  => $exit_intents,
                'rage_clicks'   => $rage_clicks,
                'bounce_rate'   => $sessions > 0 ? round((1 - ($pageviews / $sessions > 1 ? min($pageviews / $sessions, 2) - 1 : 0)) * 100) : 0,
                'top_pages'     => $top_pages,
                'top_referrers' => $top_referrers,
                'utm_sources'   => $utm_sources,
                'daily'         => $daily,
                'devices'       => $devices,
            ], 200);
        },
        'permission_callback' => function ($request) {
            return function_exists('tinyeclipse_verify_request') ? tinyeclipse_verify_request($request) : false;
        },
    ]);

    // ─── Real-time visitors (authenticated) ───
    register_rest_route('tinyeclipse/v1', '/analytics/realtime', [
        'methods' => 'GET',
        'callback' => function () {
            global $wpdb;
            $table = $wpdb->prefix . 'tinyeclipse_analytics';
            if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) {
                return new WP_REST_Response(['active_now' => 0], 200);
            }

            $five_min_ago = date('Y-m-d H:i:s', strtotime('-5 minutes'));
            $active = (int)$wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(DISTINCT session_id) FROM {$table} WHERE created_at >= %s", $five_min_ago
            ));
            $pages = $wpdb->get_results($wpdb->prepare(
                "SELECT page_path, COUNT(*) as views FROM {$table}
                 WHERE event_type = 'pageview' AND created_at >= %s
                 GROUP BY page_path ORDER BY views DESC LIMIT 10", $five_min_ago
            ), ARRAY_A);

            return new WP_REST_Response([
                'active_now' => $active,
                'pages'      => $pages,
                'timestamp'  => current_time('c'),
            ], 200);
        },
        'permission_callback' => function ($request) {
            return function_exists('tinyeclipse_verify_request') ? tinyeclipse_verify_request($request) : false;
        },
    ]);
});

// ═══════════════════════════════════════════════════════════════
// INTER-PLUGIN HOOKS — Register with core connector
// ═══════════════════════════════════════════════════════════════

// Health modules
add_filter('tinyeclipse_health_modules', function ($modules) {
    $modules['analytics'] = [
        'available'       => true,
        'version'         => TINYECLIPSE_ANALYTICS_VERSION,
        'status'          => 'healthy',
        'plugin'          => 'tinyeclipse-analytics',
        'privacy'         => 'no_cookies',
        'respect_dnt'     => true,
    ];
    return $modules;
});

// Chat commands
add_filter('tinyeclipse_chat_commands', function ($commands) {
    $commands['analytics'] = [
        'keywords' => ['analytics', 'bezoeker', 'visitor', 'pageview', 'traffic', 'verkeer'],
        'callback' => function ($msg) {
            global $wpdb;
            $table = $wpdb->prefix . 'tinyeclipse_analytics';
            if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) {
                return "📊 Analytics tabel nog niet aangemaakt. Heractiveer de plugin.";
            }
            $since = date('Y-m-d H:i:s', strtotime('-7 days'));
            $pv = (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s", $since));
            $sess = (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT session_id) FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s", $since));
            $vis = (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT visitor_id) FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s", $since));
            $five_min = date('Y-m-d H:i:s', strtotime('-5 minutes'));
            $active = (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT session_id) FROM {$table} WHERE created_at >= %s", $five_min));
            return "📊 <strong>Analytics (7 dagen)</strong><br>"
                . "Pageviews: <strong>{$pv}</strong><br>"
                . "Sessies: <strong>{$sess}</strong><br>"
                . "Unieke bezoekers: <strong>{$vis}</strong><br>"
                . "Nu actief: <strong>{$active}</strong>";
        },
    ];
    return $commands;
});

// Quick actions for chat bubble
add_filter('tinyeclipse_quick_actions', function ($actions, $is_shop) {
    $actions[] = ['key' => 'analytics', 'label' => '📊 Analytics', 'prompt' => 'analytics'];
    return $actions;
}, 10, 2);

// Helicopter stats
add_filter('tinyeclipse_helicopter_stats', function ($stats) {
    global $wpdb;
    $table = $wpdb->prefix . 'tinyeclipse_analytics';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) return $stats;

    $since = date('Y-m-d H:i:s', strtotime('-7 days'));
    $pv = (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s", $since));
    $five_min = date('Y-m-d H:i:s', strtotime('-5 minutes'));
    $active = (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT session_id) FROM {$table} WHERE created_at >= %s", $five_min));

    $stats['pageviews_7d'] = number_format($pv);
    $stats['active_now'] = $active;
    return $stats;
});

// Admin menu items
add_filter('tinyeclipse_admin_menu_items', function ($items) {
    $items[] = [
        'title' => 'Analytics',
        'slug'  => 'tinyeclipse-analytics',
        'icon'  => '📊',
        'cap'   => 'manage_options',
        'callback' => function () {
            global $wpdb;
            $table = $wpdb->prefix . 'tinyeclipse_analytics';
            $has_table = $wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table;
            $since = date('Y-m-d H:i:s', strtotime('-7 days'));
            $pv = $sess = $vis = $active = 0;
            $top_pages = [];
            if ($has_table) {
                $pv = (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s", $since));
                $sess = (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT session_id) FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s", $since));
                $vis = (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT visitor_id) FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s", $since));
                $five_min = date('Y-m-d H:i:s', strtotime('-5 minutes'));
                $active = (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT session_id) FROM {$table} WHERE created_at >= %s", $five_min));
                $top_pages = $wpdb->get_results($wpdb->prepare(
                    "SELECT page_path, page_title, COUNT(*) as views FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s GROUP BY page_path ORDER BY views DESC LIMIT 10", $since
                ));
            }
            ?>
            <div class="wrap" style="max-width:900px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                <h1 style="font-size:22px;margin-bottom:20px;">📊 Analytics Dashboard</h1>

                <?php if (!$has_table): ?>
                <div style="background:#fefce8;border:1px solid #fef08a;border-radius:12px;padding:20px;">
                    <p style="margin:0;color:#713f12;">⚠️ Analytics tabel niet gevonden. Deactiveer en heractiveer de plugin.</p>
                </div>
                <?php else: ?>

                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
                    <div style="background:linear-gradient(135deg,#6366f1,#9333ea);border-radius:12px;padding:16px;color:white;text-align:center;">
                        <div style="font-size:11px;opacity:0.8;text-transform:uppercase;">Nu Actief</div>
                        <div style="font-size:32px;font-weight:700;"><?php echo $active; ?></div>
                    </div>
                    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Pageviews (7d)</div>
                        <div style="font-size:28px;font-weight:700;color:#111827;"><?php echo number_format($pv); ?></div>
                    </div>
                    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Sessies (7d)</div>
                        <div style="font-size:28px;font-weight:700;color:#111827;"><?php echo number_format($sess); ?></div>
                    </div>
                    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Bezoekers (7d)</div>
                        <div style="font-size:28px;font-weight:700;color:#111827;"><?php echo number_format($vis); ?></div>
                    </div>
                </div>

                <?php if (!empty($top_pages)): ?>
                <h2 style="font-size:16px;margin-bottom:12px;">Top Pagina's (7 dagen)</h2>
                <table class="widefat striped" style="border-radius:10px;overflow:hidden;">
                    <thead><tr><th>Pagina</th><th>Titel</th><th>Views</th></tr></thead>
                    <tbody>
                    <?php foreach ($top_pages as $p): ?>
                    <tr>
                        <td style="font-family:monospace;font-size:12px;"><?php echo esc_html($p->page_path); ?></td>
                        <td><?php echo esc_html($p->page_title ?: '-'); ?></td>
                        <td><strong><?php echo number_format($p->views); ?></strong></td>
                    </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                <?php endif; ?>

                <div style="margin-top:20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;">
                    <h3 style="margin:0 0 8px;font-size:14px;">🔒 Privacy</h3>
                    <div style="display:flex;gap:12px;flex-wrap:wrap;">
                        <span style="background:#f0fdf4;color:#16a34a;padding:4px 12px;border-radius:20px;font-size:12px;">✅ Geen cookies</span>
                        <span style="background:#f0fdf4;color:#16a34a;padding:4px 12px;border-radius:20px;font-size:12px;">✅ IP gehasht</span>
                        <span style="background:#f0fdf4;color:#16a34a;padding:4px 12px;border-radius:20px;font-size:12px;">✅ DNT gerespecteerd</span>
                        <span style="background:#f0fdf4;color:#16a34a;padding:4px 12px;border-radius:20px;font-size:12px;">✅ Session storage only</span>
                    </div>
                </div>

                <?php endif; ?>

                <p style="text-align:center;margin-top:24px;color:#9ca3af;font-size:11px;">TinyEclipse Analytics v<?php echo TINYECLIPSE_ANALYTICS_VERSION; ?></p>
            </div>
            <?php
        },
    ];
    return $items;
});

// Client overview modules
add_filter('tinyeclipse_client_overview_modules', function ($modules) {
    global $wpdb;
    $table = $wpdb->prefix . 'tinyeclipse_analytics';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) return $modules;

    $since = date('Y-m-d H:i:s', strtotime('-7 days'));
    $pv = (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s", $since));
    $sess = (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT session_id) FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s", $since));

    $modules['analytics'] = ['active' => true, 'pageviews_7d' => $pv, 'sessions_7d' => $sess];
    return $modules;
});

// Sync data — inject analytics summary
add_filter('tinyeclipse_sync_data', function ($data, $tenant_id) {
    global $wpdb;
    $table = $wpdb->prefix . 'tinyeclipse_analytics';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) return $data;

    $since = date('Y-m-d H:i:s', strtotime('-7 days'));
    $data['analytics'] = [
        'pageviews_7d' => (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s", $since)),
        'sessions_7d'  => (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT session_id) FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s", $since)),
        'visitors_7d'  => (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT visitor_id) FROM {$table} WHERE event_type = 'pageview' AND created_at >= %s", $since)),
    ];
    return $data;
}, 10, 2);

// ═══════════════════════════════════════════════════════════════
// CRON — Cleanup old analytics data based on plan retention
// ═══════════════════════════════════════════════════════════════

add_action('init', function () {
    if (!wp_next_scheduled('tinyeclipse_analytics_cleanup')) {
        wp_schedule_event(time(), 'daily', 'tinyeclipse_analytics_cleanup');
    }
});

add_action('tinyeclipse_analytics_cleanup', function () {
    global $wpdb;
    $table = $wpdb->prefix . 'tinyeclipse_analytics';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) return;

    // Default retention: 30 days (plan-based retention handled by Hub)
    $retention = (int)get_option('tinyeclipse_analytics_retention', 30);
    $cutoff = date('Y-m-d H:i:s', strtotime("-{$retention} days"));

    $deleted = $wpdb->query($wpdb->prepare("DELETE FROM {$table} WHERE created_at < %s", $cutoff));

    if (function_exists('tinyeclipse_log') && $deleted > 0) {
        tinyeclipse_log('analytics', 'info', "Cleaned up {$deleted} analytics events older than {$retention} days");
    }
});

// ═══════════════════════════════════════════════════════════════
// ACTIVATION / DEACTIVATION
// ═══════════════════════════════════════════════════════════════

register_activation_hook(__FILE__, function () {
    global $wpdb;
    $charset = $wpdb->get_charset_collate();
    $table = $wpdb->prefix . 'tinyeclipse_analytics';

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';

    dbDelta("CREATE TABLE {$table} (
        id BIGINT UNSIGNED AUTO_INCREMENT,
        tenant_id VARCHAR(50) NOT NULL DEFAULT '',
        session_id VARCHAR(50) NOT NULL DEFAULT '',
        visitor_id VARCHAR(50) NOT NULL DEFAULT '',
        event_type VARCHAR(30) NOT NULL DEFAULT 'pageview',
        page_url VARCHAR(2000) DEFAULT '',
        page_path VARCHAR(500) DEFAULT '',
        page_title VARCHAR(500) DEFAULT '',
        referrer VARCHAR(2000) DEFAULT '',
        utm_source VARCHAR(100) DEFAULT '',
        utm_medium VARCHAR(100) DEFAULT '',
        utm_campaign VARCHAR(200) DEFAULT '',
        utm_term VARCHAR(200) DEFAULT '',
        utm_content VARCHAR(200) DEFAULT '',
        screen_w SMALLINT UNSIGNED DEFAULT 0,
        screen_h SMALLINT UNSIGNED DEFAULT 0,
        scroll_depth TINYINT UNSIGNED DEFAULT 0,
        time_on_page SMALLINT UNSIGNED DEFAULT 0,
        clicks SMALLINT UNSIGNED DEFAULT 0,
        language VARCHAR(10) DEFAULT '',
        ip_hash VARCHAR(64) DEFAULT '',
        user_agent VARCHAR(500) DEFAULT '',
        is_new TINYINT(1) DEFAULT 0,
        extra TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_tenant (tenant_id),
        KEY idx_session (session_id),
        KEY idx_visitor (visitor_id),
        KEY idx_event (event_type),
        KEY idx_path (page_path(100)),
        KEY idx_created (created_at),
        KEY idx_utm (utm_source, utm_medium)
    ) {$charset};");

    add_option('tinyeclipse_analytics_retention', 30);

    // Schedule cleanup
    if (!wp_next_scheduled('tinyeclipse_analytics_cleanup')) {
        wp_schedule_event(time(), 'daily', 'tinyeclipse_analytics_cleanup');
    }
});

register_deactivation_hook(__FILE__, function () {
    wp_clear_scheduled_hook('tinyeclipse_analytics_cleanup');
});
