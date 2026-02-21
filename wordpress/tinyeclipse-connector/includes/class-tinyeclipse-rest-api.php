<?php
/**
 * TinyEclipse REST API
 * All REST routes under tinyeclipse/v1 namespace.
 * WC-specific routes are registered by tinyeclipse-wc plugin via filter.
 * Analytics routes are registered by tinyeclipse-analytics plugin via filter.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_REST_API {

    /**
     * Register all REST routes.
     */
    public static function register_routes() {

        // ═══════════════════════════════════════════════════════════════
        // PUBLIC ROUTES
        // ═══════════════════════════════════════════════════════════════

        register_rest_route('tinyeclipse/v1', '/health', [
            'methods' => 'GET',
            'callback' => function () {
                $modules = apply_filters('tinyeclipse_health_modules', [
                    'core' => ['available' => true, 'version' => TINYECLIPSE_VERSION, 'status' => 'healthy'],
                ]);
                return new WP_REST_Response([
                    'status'  => 'ok',
                    'version' => TINYECLIPSE_VERSION,
                    'site'    => get_bloginfo('name'),
                    'modules' => $modules,
                    'time'    => current_time('c'),
                ], 200);
            },
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('tinyeclipse/v1', '/hub/status', [
            'methods' => 'GET',
            'callback' => function () {
                $site_id = tinyeclipse_get_tenant_id();
                return new WP_REST_Response([
                    'connected'   => !empty($site_id),
                    'site_id'     => $site_id,
                    'site_url'    => get_site_url(),
                    'version'     => TINYECLIPSE_VERSION,
                    'environment' => tinyeclipse_is_staging() ? 'staging' : 'production',
                ], 200);
            },
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('tinyeclipse/v1', '/config', [
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response([
                    'tenant_id' => tinyeclipse_get_tenant_id(),
                    'enabled'   => (bool)get_option('tinyeclipse_enabled', false),
                    'color'     => get_option('tinyeclipse_color', '#6C3CE1'),
                    'name'      => get_option('tinyeclipse_name', get_bloginfo('name') . ' AI'),
                    'lang'      => get_option('tinyeclipse_lang', 'nl'),
                    'position'  => get_option('tinyeclipse_position', 'bottom-right'),
                    'version'   => TINYECLIPSE_VERSION,
                    'site_url'  => get_site_url(),
                    'site_name' => get_bloginfo('name'),
                ], 200);
            },
            'permission_callback' => '__return_true',
        ]);

        // ═══════════════════════════════════════════════════════════════
        // HUB ROUTES (authenticated)
        // ═══════════════════════════════════════════════════════════════

        register_rest_route('tinyeclipse/v1', '/hub/fingerprint', [
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response(TinyEclipse_Hub::instance()->get_fingerprint(), 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/hub/onboard', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $data = $request->get_json_params() ?: [];
                return new WP_REST_Response(TinyEclipse_Hub::instance()->onboard($data), 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/hub/config', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $request->get_json_params();
                $updated = [];
                if (is_array($params)) {
                    foreach ($params as $key => $value) {
                        if (strpos($key, 'tinyeclipse_') === 0) {
                            update_option($key, $value);
                            $updated[] = $key;
                        }
                    }
                }
                do_action('tinyeclipse_settings_saved', $params);
                return new WP_REST_Response(['status' => 'updated', 'options' => $updated], 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/hub/pivot', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $request->get_json_params();
                $result = TinyEclipse_Hub::instance()->pivot($params['new_domain'] ?? '');
                return new WP_REST_Response(['status' => $result ? 'pivoted' : 'failed'], $result ? 200 : 500);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        // ═══════════════════════════════════════════════════════════════
        // CORE ROUTES
        // ═══════════════════════════════════════════════════════════════

        register_rest_route('tinyeclipse/v1', '/report', [
            'methods' => 'GET',
            'callback' => function () {
                $report = TinyEclipse_Collector::instance()->get_latest_report();
                return new WP_REST_Response($report ?: ['message' => 'No reports yet'], $report ? 200 : 404);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/snapshot', [
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response(TinyEclipse_Collector::instance()->get_snapshot(), 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/logs', [
            'methods' => 'GET',
            'callback' => function ($request) {
                global $wpdb;
                $table = $wpdb->prefix . 'tinyeclipse_logs';
                if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) {
                    return new WP_REST_Response(['logs' => []], 200);
                }
                $limit = min((int)($request->get_param('limit') ?: 100), 500);
                $module = sanitize_text_field($request->get_param('module') ?: '');
                $where = $module ? $wpdb->prepare(" WHERE module = %s", $module) : '';
                $logs = $wpdb->get_results("SELECT * FROM {$table}{$where} ORDER BY id DESC LIMIT {$limit}", ARRAY_A);
                return new WP_REST_Response(['total' => count($logs), 'logs' => $logs], 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/security', [
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response(TinyEclipse_Security::instance()->audit(), 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/mail', [
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response(TinyEclipse_Mail::instance()->get_status(), 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/query', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $request->get_json_params();
                $query = $params['query'] ?? '';
                // Forward to Hub for AI processing
                $site_id = tinyeclipse_get_tenant_id();
                $response = wp_remote_post(TINYECLIPSE_API_BASE . '/api/admin/wp/' . $site_id . '/query', [
                    'timeout' => 30,
                    'headers' => ['Content-Type' => 'application/json', 'X-Tenant-Id' => $site_id],
                    'body'    => wp_json_encode(['query' => $query, 'context' => TinyEclipse_Collector::instance()->get_snapshot()]),
                ]);
                if (is_wp_error($response)) return new WP_REST_Response(['error' => $response->get_error_message()], 500);
                return new WP_REST_Response(json_decode(wp_remote_retrieve_body($response), true), 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/command', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $request->get_json_params();
                $action = sanitize_text_field($params['action'] ?? '');
                $allowed = apply_filters('tinyeclipse_allowed_commands', ['scan', 'report', 'sync', 'heartbeat', 'flush_cache']);
                if (!in_array($action, $allowed)) {
                    return new WP_REST_Response(['error' => 'Unknown command'], 400);
                }
                switch ($action) {
                    case 'scan': $result = TinyEclipse_Collector::instance()->run_hourly_scan(); break;
                    case 'report': $result = TinyEclipse_Collector::instance()->run_daily_report(); break;
                    case 'sync': $result = TinyEclipse_Collector::instance()->run_daily_report(); break;
                    case 'flush_cache': if (function_exists('wp_cache_flush')) wp_cache_flush(); $result = ['flushed' => true]; break;
                    default: $result = ['executed' => $action];
                }
                return new WP_REST_Response($result, 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/heartbeat', [
            'methods' => 'POST',
            'callback' => function () {
                delete_transient('tinyeclipse_last_heartbeat');
                TinyEclipse_Hub::instance()->maybe_heartbeat();
                return new WP_REST_Response(['status' => 'ok', 'time' => current_time('c')], 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        // ═══════════════════════════════════════════════════════════════
        // TRANSLATION ROUTES
        // ═══════════════════════════════════════════════════════════════

        register_rest_route('tinyeclipse/v1', '/translation/audit', [
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response(TinyEclipse_Translation::instance()->audit(), 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/translation/missing/(?P<lang>[a-z]{2})', [
            'methods' => 'GET',
            'callback' => function ($request) {
                $missing = TinyEclipse_Translation::instance()->get_missing($request['lang']);
                return new WP_REST_Response(['language' => $request['lang'], 'total' => count($missing), 'items' => $missing], 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/translation/incomplete/(?P<lang>[a-z]{2})', [
            'methods' => 'GET',
            'callback' => function ($request) {
                $incomplete = TinyEclipse_Translation::instance()->get_incomplete($request['lang']);
                return new WP_REST_Response(['language' => $request['lang'], 'total' => count($incomplete), 'items' => $incomplete], 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/translation/content/(?P<id>\d+)', [
            'methods' => 'GET',
            'callback' => function ($request) {
                $content = TinyEclipse_Translation::instance()->get_content((int)$request['id']);
                return $content ? new WP_REST_Response($content, 200) : new WP_REST_Response(['error' => 'Not found'], 404);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/translation/apply', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $p = $request->get_json_params();
                $result = TinyEclipse_Translator::instance()->apply_translation(
                    (int)($p['post_id'] ?? 0), $p['language'] ?? '', $p['title'] ?? '', $p['content'] ?? '', $p['excerpt'] ?? ''
                );
                return is_wp_error($result) ? new WP_REST_Response(['error' => $result->get_error_message()], 400) : new WP_REST_Response($result, 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/translation/batch', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $p = $request->get_json_params();
                $lang = $p['language'] ?? '';
                $post_ids = $p['post_ids'] ?? [];
                $results = [];
                foreach ($post_ids as $pid) {
                    $translated = TinyEclipse_Translator::instance()->translate_single((int)$pid, $lang);
                    if (!is_wp_error($translated)) {
                        $applied = TinyEclipse_Translator::instance()->apply_translation($pid, $lang, $translated['title'], $translated['content'], $translated['excerpt'] ?? '');
                        $results[] = is_wp_error($applied) ? ['post_id' => $pid, 'error' => $applied->get_error_message()] : $applied;
                    } else {
                        $results[] = ['post_id' => $pid, 'error' => $translated->get_error_message()];
                    }
                }
                return new WP_REST_Response(['language' => $lang, 'results' => $results], 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        // ═══════════════════════════════════════════════════════════════
        // AI TRANSLATE ROUTES
        // ═══════════════════════════════════════════════════════════════

        register_rest_route('tinyeclipse/v1', '/translate/overview', [
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response(TinyEclipse_Translator::instance()->get_overview(), 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/translate/single', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $p = $request->get_json_params();
                $result = TinyEclipse_Translator::instance()->translate_single((int)($p['post_id'] ?? 0), $p['language'] ?? '');
                return is_wp_error($result) ? new WP_REST_Response(['error' => $result->get_error_message()], 400) : new WP_REST_Response($result, 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/translate/progress', [
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response(TinyEclipse_Translator::instance()->get_progress(), 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        // ═══════════════════════════════════════════════════════════════
        // JOBS ROUTES
        // ═══════════════════════════════════════════════════════════════

        register_rest_route('tinyeclipse/v1', '/jobs/audit', [
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response(TinyEclipse_Jobs::instance()->audit(), 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/jobs/(?P<id>\d+)', [
            'methods' => 'GET',
            'callback' => function ($request) {
                $job = TinyEclipse_Jobs::instance()->get_job((int)$request['id']);
                return $job ? new WP_REST_Response($job, 200) : new WP_REST_Response(['error' => 'Not found'], 404);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/jobs/create', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $result = TinyEclipse_Jobs::instance()->create_job($request->get_json_params());
                return is_wp_error($result) ? new WP_REST_Response(['error' => $result->get_error_message()], 400) : new WP_REST_Response($result, 201);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/jobs/update/(?P<id>\d+)', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $result = TinyEclipse_Jobs::instance()->update_job((int)$request['id'], $request->get_json_params());
                return is_wp_error($result) ? new WP_REST_Response(['error' => $result->get_error_message()], 400) : new WP_REST_Response($result, 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/jobs/close/(?P<id>\d+)', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $result = TinyEclipse_Jobs::instance()->close_job((int)$request['id']);
                return is_wp_error($result) ? new WP_REST_Response(['error' => $result->get_error_message()], 400) : new WP_REST_Response($result, 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/jobs/publish/(?P<id>\d+)', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $result = TinyEclipse_Jobs::instance()->publish_job((int)$request['id']);
                return is_wp_error($result) ? new WP_REST_Response(['error' => $result->get_error_message()], 400) : new WP_REST_Response($result, 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/jobs/smart-links/(?P<id>\d+)', [
            'methods' => 'GET',
            'callback' => function ($request) {
                return new WP_REST_Response(TinyEclipse_Jobs::instance()->get_smart_links((int)$request['id']), 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/jobs/applications', [
            'methods' => 'GET',
            'callback' => function ($request) {
                $limit = min((int)($request->get_param('limit') ?: 50), 200);
                $apps = TinyEclipse_Jobs::instance()->get_applications($limit);
                return new WP_REST_Response(['total' => count($apps), 'applications' => $apps], 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/jobs/ai-generate', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $result = TinyEclipse_Jobs::instance()->ai_generate($request->get_json_params());
                return is_wp_error($result) ? new WP_REST_Response(['error' => $result->get_error_message()], 400) : new WP_REST_Response($result, 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/jobs/ai-create', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $p = $request->get_json_params();
                // First generate, then create
                $generated = TinyEclipse_Jobs::instance()->ai_generate($p);
                if (is_wp_error($generated)) return new WP_REST_Response(['error' => $generated->get_error_message()], 400);
                $result = TinyEclipse_Jobs::instance()->create_job(array_merge($p, ['content' => $generated['content']]));
                return is_wp_error($result) ? new WP_REST_Response(['error' => $result->get_error_message()], 400) : new WP_REST_Response($result, 201);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        // ═══════════════════════════════════════════════════════════════
        // FORMS ROUTES
        // ═══════════════════════════════════════════════════════════════

        register_rest_route('tinyeclipse/v1', '/forms/audit', [
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response(TinyEclipse_Forms::instance()->audit(), 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/forms/submissions', [
            'methods' => 'GET',
            'callback' => function ($request) {
                $form_id = (int)$request->get_param('form_id');
                $limit = min((int)($request->get_param('limit') ?: 50), 200);
                if (!$form_id) return new WP_REST_Response(['error' => 'form_id required'], 400);
                $subs = TinyEclipse_Forms::instance()->get_submissions($form_id, $limit);
                return new WP_REST_Response(['form_id' => $form_id, 'total' => count($subs), 'submissions' => $subs], 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        // ═══════════════════════════════════════════════════════════════
        // CLIENT PORTAL ROUTES
        // ═══════════════════════════════════════════════════════════════

        register_rest_route('tinyeclipse/v1', '/client/overview', [
            'methods' => 'GET',
            'callback' => function () {
                $modules = [
                    'security' => class_exists('TinyEclipse_Security') ? TinyEclipse_Security::instance()->audit() : null,
                    'seo'      => class_exists('TinyEclipse_SEO') ? TinyEclipse_SEO::instance()->audit() : null,
                    'mail'     => class_exists('TinyEclipse_Mail') ? TinyEclipse_Mail::instance()->get_status() : null,
                    'forms'    => class_exists('TinyEclipse_Forms') ? TinyEclipse_Forms::instance()->audit() : null,
                    'jobs'     => class_exists('TinyEclipse_Jobs') ? TinyEclipse_Jobs::instance()->audit() : null,
                ];
                $modules = apply_filters('tinyeclipse_client_overview_modules', $modules);
                return new WP_REST_Response([
                    'site_url' => get_site_url(), 'site_name' => get_bloginfo('name'),
                    'version' => TINYECLIPSE_VERSION, 'modules' => $modules,
                ], 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/client/module/(?P<module>[a-z]+)', [
            'methods' => 'GET',
            'callback' => function ($request) {
                $mod = $request['module'];
                $data = null;
                switch ($mod) {
                    case 'security': $data = TinyEclipse_Security::instance()->audit(); break;
                    case 'seo': $data = TinyEclipse_SEO::instance()->audit(); break;
                    case 'mail': $data = TinyEclipse_Mail::instance()->get_status(); break;
                    case 'forms': $data = TinyEclipse_Forms::instance()->audit(); break;
                    case 'jobs': $data = TinyEclipse_Jobs::instance()->audit(); break;
                    case 'translation': $data = TinyEclipse_Translation::instance()->audit(); break;
                }
                return $data ? new WP_REST_Response($data, 200) : new WP_REST_Response(['error' => 'Unknown module'], 404);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/client/action', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $p = $request->get_json_params();
                $action = $p['action'] ?? '';
                switch ($action) {
                    case 'security_fix':
                        $result = TinyEclipse_Security::instance()->apply_fix($p['fix_type'] ?? '');
                        break;
                    case 'scan':
                        $result = TinyEclipse_Collector::instance()->run_hourly_scan();
                        break;
                    default:
                        $result = ['error' => 'Unknown action'];
                }
                return new WP_REST_Response($result, 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        // ═══════════════════════════════════════════════════════════════
        // SYNC + WRITE ROUTES
        // ═══════════════════════════════════════════════════════════════

        register_rest_route('tinyeclipse/v1', '/sync/full', [
            'methods' => 'POST',
            'callback' => function () {
                $result = TinyEclipse_Collector::instance()->run_daily_report();
                return new WP_REST_Response($result, 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/pages/(?P<id>\d+)', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $post_id = (int)$request['id'];
                $post = get_post($post_id);
                if (!$post) return new WP_REST_Response(['error' => 'Post not found'], 404);
                $params = $request->get_json_params();
                $update = ['ID' => $post_id];
                if (isset($params['title'])) $update['post_title'] = sanitize_text_field($params['title']);
                if (isset($params['content'])) $update['post_content'] = wp_kses_post($params['content']);
                if (isset($params['status'])) $update['post_status'] = sanitize_text_field($params['status']);
                if (isset($params['excerpt'])) $update['post_excerpt'] = sanitize_text_field($params['excerpt']);
                $result = wp_update_post($update, true);
                if (is_wp_error($result)) return new WP_REST_Response(['error' => $result->get_error_message()], 500);
                return new WP_REST_Response(['status' => 'updated', 'post_id' => $post_id, 'title' => get_the_title($post_id), 'url' => get_permalink($post_id)], 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/options', [
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $request->get_json_params();
                $updated = [];
                $allowed = ['blogname', 'blogdescription', 'woocommerce_email_from_address', 'woocommerce_email_from_name'];
                foreach ($params as $key => $value) {
                    if (in_array($key, $allowed)) {
                        update_option($key, sanitize_text_field($value));
                        $updated[] = $key;
                    }
                }
                return new WP_REST_Response(['status' => 'updated', 'options' => $updated], 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/content', [
            'methods' => 'GET',
            'callback' => function ($request) {
                $type = $request->get_param('type') ?: 'page';
                $limit = min((int)($request->get_param('limit') ?: 100), 200);
                $posts = get_posts(['post_type' => $type, 'post_status' => 'any', 'numberposts' => $limit, 'orderby' => 'date', 'order' => 'DESC']);
                $result = [];
                foreach ($posts as $p) {
                    $result[] = [
                        'id' => $p->ID, 'title' => $p->post_title, 'slug' => $p->post_name,
                        'status' => $p->post_status, 'type' => $p->post_type,
                        'content' => wp_strip_all_tags($p->post_content),
                        'excerpt' => $p->post_excerpt, 'url' => get_permalink($p->ID),
                        'modified' => $p->post_modified, 'author' => get_the_author_meta('display_name', $p->post_author),
                    ];
                }
                return new WP_REST_Response(['total' => count($result), 'items' => $result], 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/capabilities', [
            'methods' => 'GET',
            'callback' => function () {
                $active_plugins = get_option('active_plugins', []);
                $has = function ($slug) use ($active_plugins) {
                    foreach ($active_plugins as $p) { if (strpos($p, $slug) !== false) return true; }
                    return false;
                };
                return new WP_REST_Response([
                    'wordpress' => true, 'version' => get_bloginfo('version'), 'php' => phpversion(),
                    'woocommerce' => class_exists('WooCommerce'), 'woo_version' => defined('WC_VERSION') ? WC_VERSION : null,
                    'wpml' => function_exists('icl_get_languages'),
                    'fluent_forms' => function_exists('wpFluent') || $has('fluentform'),
                    'fluent_smtp' => $has('fluent-smtp'), 'wp_mail_smtp' => $has('wp-mail-smtp'),
                    'contact_form_7' => $has('contact-form-7'), 'gravity_forms' => $has('gravityforms'),
                    'job_manager' => $has('wp-job-manager'), 'amelia_booking' => $has('ameliabooking'),
                    'elementor' => $has('elementor'), 'yoast' => $has('wordpress-seo'), 'rank_math' => $has('seo-by-flavor'),
                    'tinyeclipse_wc' => defined('TINYECLIPSE_WC_VERSION'), 'tinyeclipse_analytics' => defined('TINYECLIPSE_ANALYTICS_VERSION'),
                    'theme' => get_stylesheet(), 'multisite' => is_multisite(),
                    'locale' => get_locale(), 'timezone' => wp_timezone_string(),
                    'site_url' => get_site_url(), 'home_url' => get_home_url(),
                    'plugin_count' => count($active_plugins),
                ], 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        // ═══════════════════════════════════════════════════════════════
        // WPML COMPAT ROUTES (from old connector)
        // ═══════════════════════════════════════════════════════════════

        register_rest_route('tinyeclipse/v1', '/wpml/languages', [
            'methods' => 'GET',
            'callback' => function () {
                if (!function_exists('icl_get_languages')) return new WP_REST_Response(['active' => false], 200);
                $langs = icl_get_languages('skip_missing=0');
                $default = apply_filters('wpml_default_language', null);
                return new WP_REST_Response([
                    'active' => true, 'default_language' => $default,
                    'languages' => array_map(function ($l) {
                        return ['code' => $l['code'], 'name' => $l['native_name'], 'english_name' => $l['translated_name'], 'active' => (bool)$l['active'], 'url' => $l['url']];
                    }, array_values($langs)),
                    'total' => count($langs),
                ], 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/wpml/status', [
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response(TinyEclipse_Translation::instance()->audit(), 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/forms', [
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response(TinyEclipse_Forms::instance()->audit(), 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        register_rest_route('tinyeclipse/v1', '/mail/status', [
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response(TinyEclipse_Mail::instance()->get_status(), 200);
            },
            'permission_callback' => 'tinyeclipse_verify_request',
        ]);

        // ═══════════════════════════════════════════════════════════════
        // ALLOW ADD-ON PLUGINS TO REGISTER EXTRA ROUTES
        // ═══════════════════════════════════════════════════════════════

        $extra_routes = apply_filters('tinyeclipse_rest_routes', []);
        foreach ($extra_routes as $route) {
            if (!empty($route['path']) && !empty($route['callback'])) {
                register_rest_route('tinyeclipse/v1', $route['path'], [
                    'methods'             => $route['methods'] ?? 'GET',
                    'callback'            => $route['callback'],
                    'permission_callback' => $route['permission_callback'] ?? 'tinyeclipse_verify_request',
                ]);
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // BACKWARDS COMPAT — eclipse-ai/v1 aliases (6 month transition)
        // ═══════════════════════════════════════════════════════════════

        $compat_routes = ['/health', '/hub/status', '/hub/fingerprint', '/report', '/snapshot', '/security', '/mail'];
        foreach ($compat_routes as $path) {
            register_rest_route('eclipse-ai/v1', $path, [
                'methods' => 'GET',
                'callback' => function () use ($path) {
                    return new WP_REST_Response(['redirect' => "tinyeclipse/v1{$path}", 'message' => 'Use tinyeclipse/v1 namespace'], 301);
                },
                'permission_callback' => '__return_true',
            ]);
        }
    }
}
