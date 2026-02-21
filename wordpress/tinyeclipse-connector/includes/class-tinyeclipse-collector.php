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

    /**
     * Collect product intelligence for AI learning.
     */
    public function collect_product_intelligence() {
        if (!class_exists('WooCommerce')) {
            return ['active' => false, 'message' => 'WooCommerce not active'];
        }

        global $wpdb;
        $products = $wpdb->get_results("
            SELECT p.ID, p.post_title, p.post_content, p.post_excerpt,
                   pm1.meta_value as price, pm2.meta_value as sale_price,
                   pm3.meta_value as stock_status, pm4.meta_value as stock_quantity
            FROM {$wpdb->posts} p
            LEFT JOIN {$wpdb->postmeta} pm1 ON p.ID = pm1.post_id AND pm1.meta_key = '_price'
            LEFT JOIN {$wpdb->postmeta} pm2 ON p.ID = pm2.post_id AND pm2.meta_key = '_sale_price'
            LEFT JOIN {$wpdb->postmeta} pm3 ON p.ID = pm3.post_id AND pm3.meta_key = '_stock_status'
            LEFT JOIN {$wpdb->postmeta} pm4 ON p.ID = pm4.post_id AND pm4.meta_key = '_stock_quantity'
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            LIMIT 100
        ");

        $intelligence = [];
        foreach ($products as $product) {
            $product_data = [
                'id' => $product->ID,
                'name' => $product->post_title,
                'description' => $product->post_content,
                'short_description' => $product->post_excerpt,
                'price' => $product->price,
                'sale_price' => $product->sale_price,
                'stock_status' => $product->stock_status,
                'stock_quantity' => $product->stock_quantity,
                'url' => get_permalink($product->ID),
            ];

            // Extract ingredients and allergens from content
            $product_data['ingredients'] = $this->extract_ingredients($product->post_content);
            $product_data['allergens'] = $this->extract_allergens($product->post_content);
            $product_data['specifications'] = $this->extract_specifications($product->post_content);
            
            // Get categories
            $categories = get_the_terms($product->ID, 'product_cat');
            $product_data['categories'] = $categories ? array_map(function($cat) {
                return ['name' => $cat->name, 'slug' => $cat->slug];
            }, $categories) : [];

            // Get attributes
            $attributes = get_post_meta($product->ID, '_product_attributes', true);
            $product_data['attributes'] = $this->parse_product_attributes($attributes);

            $intelligence[] = $product_data;
        }

        return [
            'active' => true,
            'total_products' => count($intelligence),
            'products' => $intelligence,
            'collected_at' => current_time('c')
        ];
    }

    /**
     * Extract ingredients from product content.
     */
    private function extract_ingredients($content) {
        $ingredients = [];
        
        // Look for ingredient lists
        if (preg_match('/(Ingrediënten|Ingredients)[:\s]*([^\n]+)/i', $content, $matches)) {
            $ingredient_list = $matches[2];
            $ingredients = array_map('trim', explode(',', $ingredient_list));
        }
        
        // Look for structured data
        if (preg_match_all('/<span[^>]*class="[^"]*ingredient[^"]*"[^>]*>([^<]+)<\/span>/i', $content, $matches)) {
            $ingredients = array_merge($ingredients, $matches[1]);
        }
        
        return array_unique(array_filter($ingredients));
    }

    /**
     * Extract allergens from product content.
     */
    private function extract_allergens($content) {
        $allergens = [];
        $common_allergens = ['gluten', 'noten', 'pinda', 'melk', 'ei', 'soja', 'vis', 'schelpdieren', 'schaaldieren', 'sesam', 'mosterd', 'lupine', 'selderij'];
        
        foreach ($common_allergens as $allergen) {
            if (preg_match("/\b" . preg_quote($allergen, '/') . "\b/i", $content)) {
                $allergens[] = $allergen;
            }
        }
        
        return $allergens;
    }

    /**
     * Extract specifications from product content.
     */
    private function extract_specifications($content) {
        $specs = [];
        
        // Look for weight/volume
        if (preg_match('/(\d+(?:\.\d+)?)\s*(g|kg|ml|l|cl)/i', $content, $matches)) {
            $specs['weight_volume'] = $matches[0];
        }
        
        // Look for dimensions
        if (preg_match('/(\d+(?:\.\d+)?)\s*?x\s*?(\d+(?:\.\d+)?)\s*?x\s*?(\d+(?:\.\d+)?)\s*(cm|mm)/i', $content, $matches)) {
            $specs['dimensions'] = $matches[0];
        }
        
        // Look for shelf life
        if (preg_match('/(houdbaar|best before)[:\s]*([^\n]+)/i', $content, $matches)) {
            $specs['shelf_life'] = trim($matches[2]);
        }
        
        return $specs;
    }

    /**
     * Parse WooCommerce product attributes.
     */
    private function parse_product_attributes($attributes) {
        if (!is_array($attributes)) return [];
        
        $parsed = [];
        foreach ($attributes as $name => $attribute) {
            if (isset($attribute['value'])) {
                $values = array_map('trim', explode('|', $attribute['value']));
                $parsed[$name] = $values;
            }
        }
        
        return $parsed;
    }

    /**
     * Collect opening hours from multiple sources.
     */
    public function collect_opening_hours() {
        $hours = [];
        
        // 1. Check ACF fields
        if (function_exists('get_field')) {
            $acf_hours = get_field('opening_hours', 'options');
            if ($acf_hours) {
                $hours['acf'] = $acf_hours;
            }
        }
        
        // 2. Check WordPress options
        $wp_hours = get_option('opening_hours');
        if ($wp_hours) {
            $hours['wordpress'] = $wp_hours;
        }
        
        // 3. Check Google Business (simulated - would need API integration)
        $hours['google_business'] = $this->get_google_business_hours();
        
        // 4. Check site content for opening hours
        $hours['content'] = $this->extract_hours_from_content();
        
        return [
            'active' => true,
            'sources' => $hours,
            'consolidated' => $this->consolidate_hours($hours),
            'collected_at' => current_time('c')
        ];
    }

    /**
     * Get Google Business opening hours (placeholder).
     */
    private function get_google_business_hours() {
        // This would integrate with Google Business API
        return [
            'monday' => '09:00-18:00',
            'tuesday' => '09:00-18:00',
            'wednesday' => '09:00-18:00',
            'thursday' => '09:00-18:00',
            'friday' => '09:00-18:00',
            'saturday' => '10:00-16:00',
            'sunday' => 'gesloten'
        ];
    }

    /**
     * Extract opening hours from site content.
     */
    private function extract_hours_from_content() {
        global $wpdb;
        
        $pages = $wpdb->get_results("
            SELECT post_content 
            FROM {$wpdb->posts} 
            WHERE post_status = 'publish' 
            AND (post_content LIKE '%opening%' OR post_content LIKE '%openingstijden%')
            LIMIT 10
        ");
        
        $hours = [];
        foreach ($pages as $page) {
            if (preg_match('/(maandag|monday)[:\s]*([0-9:]+-[0-9:]+)/i', $page->post_content, $matches)) {
                $hours['monday'] = $matches[2];
            }
            // Add more patterns for other days...
        }
        
        return $hours;
    }

    /**
     * Consolidate opening hours from multiple sources.
     */
    private function consolidate_hours($sources) {
        $consolidated = [];
        $days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        foreach ($days as $day) {
            foreach ($sources as $source => $data) {
                if (is_array($data) && isset($data[$day])) {
                    $consolidated[$day] = $data[$day];
                    break; // Use first available source
                }
            }
        }
        
        return $consolidated;
    }

    /**
     * Sync knowledge data to Hub.
     */
    public function sync_knowledge_to_hub($force = false) {
        // Rate limiting - don't sync more than once per hour unless forced
        $last_sync = get_option('tinyeclipse_last_knowledge_sync', 0);
        if (!$force && (time() - strtotime($last_sync)) < 3600) {
            return ['success' => false, 'message' => 'Rate limited - sync was performed recently'];
        }

        // Collect all knowledge data
        $data = [
            'tenant_id' => tinyeclipse_get_tenant_id(),
            'site_url' => get_site_url(),
            'site_name' => get_bloginfo('name'),
            'synced_at' => current_time('c'),
            'environment' => tinyeclipse_is_staging() ? 'staging' : 'production',
            'products' => $this->collect_product_intelligence(),
            'opening_hours' => $this->collect_opening_hours(),
            'site_content' => $this->collect_all(),
        ];

        // Send to Hub
        $response = wp_remote_post(TINYECLIPSE_API_BASE . '/api/knowledge/sync', [
            'timeout' => 30,
            'headers' => [
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . get_option('tinyeclipse_hub_api_key', ''),
                'X-Tenant-Id' => tinyeclipse_get_tenant_id(),
                'User-Agent' => 'TinyEclipse-Connector/' . TINYECLIPSE_VERSION
            ],
            'body' => wp_json_encode($data)
        ]);

        if (is_wp_error($response)) {
            tinyeclipse_log('knowledge_sync', 'error', 'Knowledge sync failed', [
                'error' => $response->get_error_message(),
                'tenant_id' => tinyeclipse_get_tenant_id()
            ]);
            return ['success' => false, 'message' => $response->get_error_message()];
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        // Update last sync
        update_option('tinyeclipse_last_knowledge_sync', current_time('mysql'));
        
        // Log successful sync
        tinyeclipse_log('knowledge_sync', 'info', 'Knowledge sync completed', [
            'tenant_id' => tinyeclipse_get_tenant_id(),
            'products_count' => $data['products']['total_products'] ?? 0,
            'hub_response' => $body
        ]);

        return [
            'success' => true,
            'message' => 'Knowledge sync completed',
            'synced_at' => current_time('c'),
            'products_synced' => $data['products']['total_products'] ?? 0,
            'hub_response' => $body
        ];
    }
}
