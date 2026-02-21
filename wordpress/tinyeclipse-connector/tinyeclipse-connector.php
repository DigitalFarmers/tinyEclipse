<?php
/**
 * Plugin Name: TinyEclipse Connector
 * Plugin URI: https://tinyeclipse.digitalfarmers.be
 * Description: Core connector for TinyEclipse — AI-powered WordPress site management, security, SEO, mail, translation, jobs, forms & token system by Digital Farmers.
 * Version: 5.0.0
 * Author: Digital Farmers
 * Author URI: https://digitalfarmers.be
 * License: GPL v2 or later
 * Text Domain: tinyeclipse
 * Domain Path: /languages
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) exit;

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

define('TINYECLIPSE_VERSION', '5.0.0');
define('TINYECLIPSE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('TINYECLIPSE_PLUGIN_URL', plugin_dir_url(__FILE__));
define('TINYECLIPSE_API_BASE', 'https://api.tinyeclipse.digitalfarmers.be');
define('TINYECLIPSE_HUB_URL', 'https://tinyeclipse.digitalfarmers.be');

// ═══════════════════════════════════════════════════════════════
// GLOBAL HELPER FUNCTIONS — Used by add-on plugins (WC, Analytics)
// ═══════════════════════════════════════════════════════════════

function tinyeclipse_get_tenant_id() {
    return get_option('tinyeclipse_site_id', get_option('tinyeclipse_tenant_id', ''));
}

function tinyeclipse_is_staging() {
    if (function_exists('wp_get_environment_type')) {
        $env = wp_get_environment_type();
        if (in_array($env, ['staging', 'development', 'local'])) return true;
    }
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
    if (strpos($host, 'staging.') === 0 || strpos($host, 'dev.') === 0 || strpos($host, 'test.') === 0) return true;
    if (strpos($host, '.local') !== false || strpos($host, 'localhost') !== false) return true;
    return false;
}

function tinyeclipse_send_event($module_type, $event_type, $title, $description = '', $data = [], $source_url = '') {
    $tenant_id = tinyeclipse_get_tenant_id();
    if (empty($tenant_id)) return;

    $data['environment'] = tinyeclipse_is_staging() ? 'staging' : 'production';
    $data['site_url'] = get_site_url();
    $data['site_name'] = get_bloginfo('name');

    wp_remote_post(TINYECLIPSE_API_BASE . '/api/module-events/' . $tenant_id, [
        'timeout'  => 5,
        'blocking' => false,
        'headers'  => ['Content-Type' => 'application/json'],
        'body'     => wp_json_encode([
            'module_type' => $module_type, 'event_type' => $event_type,
            'title' => $title, 'description' => $description,
            'data' => $data, 'source_url' => $source_url ?: get_site_url(),
        ]),
    ]);
}

function tinyeclipse_verify_request($request) {
    // Hub key auth
    $hub_key = get_option('tinyeclipse_hub_api_key', '');
    $auth = $request->get_header('Authorization');
    if ($hub_key && $auth === 'Bearer ' . $hub_key) return true;

    // Tenant ID auth (backwards compat)
    $tenant = $request->get_header('X-Tenant-Id');
    $stored = tinyeclipse_get_tenant_id();
    if (!empty($stored) && $tenant === $stored) return true;

    return new WP_Error('unauthorized', 'Invalid auth', ['status' => 403]);
}

function tinyeclipse_log($module, $level, $message, $context = []) {
    global $wpdb;
    $table = $wpdb->prefix . 'tinyeclipse_logs';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) return;
    $wpdb->insert($table, [
        'module'     => $module,
        'level'      => $level,
        'message'    => $message,
        'context'    => wp_json_encode($context),
        'created_at' => current_time('mysql'),
    ]);
}

// ═══════════════════════════════════════════════════════════════
// UNIVERSAL DATE/TIME FORMATTING — All TinyEclipse sites use DD/MM/YYYY + 24u
// ═══════════════════════════════════════════════════════════════

function tinyeclipse_format_date($timestamp = null) {
    if ($timestamp === null) $timestamp = current_time('timestamp');
    return date('d/m/Y', $timestamp);
}

function tinyeclipse_format_time($timestamp = null) {
    if ($timestamp === null) $timestamp = current_time('timestamp');
    return date('H:i', $timestamp);
}

function tinyeclipse_format_datetime($timestamp = null) {
    if ($timestamp === null) $timestamp = current_time('timestamp');
    return date('d/m/Y H:i', $timestamp);
}

// MySQL compatible versions for database storage
function tinyeclipse_mysql_date($timestamp = null) {
    if ($timestamp === null) $timestamp = current_time('timestamp');
    return date('Y-m-d', $timestamp);
}

function tinyeclipse_mysql_datetime($timestamp = null) {
    if ($timestamp === null) $timestamp = current_time('timestamp');
    return date('Y-m-d H:i:s', $timestamp);
}

// ═══════════════════════════════════════════════════════════════
// LANGUAGE DETECTION — Detect user language from question text
// ═══════════════════════════════════════════════════════════════

function tinyeclipse_detect_language($text) {
    $text = strtolower(trim($text));
    
    // French keywords
    $french_keywords = ['bonjour', 'merci', 's\'il vous plaît', 'aujourd\'hui', 'commande', 'produit', 'livraison', 'bon', 'je', 'vous', 'le', 'la', 'est', 'dans', 'pour', 'avec', 'pas', 'une', 'des', 'du', 'que', 'qui', 'ce', 'se', 'ne', 'me', 'te', 'lui', 'leur', 'y', 'en', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'mais', 'où', 'quand', 'comment', 'pourquoi', 'quel', 'quelle', 'quels', 'quelles'];
    
    // Dutch keywords  
    $dutch_keywords = ['hallo', 'dank je', 'alsjeblieft', 'vandaag', 'bestelling', 'product', 'levering', 'goed', 'ik', 'jij', 'de', 'het', 'is', 'in', 'voor', 'met', 'niet', 'een', 'van', 'dat', 'die', 'dit', 'zal', 'kunnen', 'moeten', 'willen', 'mogen', 'hebben', 'zijn', 'worden', 'gaan', 'komen', 'zien', 'doen', 'laten', 'houden', 'geven', 'brengen', 'zeggen', 'worden', 'maken'];
    
    // English keywords
    $english_keywords = ['hello', 'thank', 'please', 'today', 'order', 'product', 'delivery', 'good', 'i', 'you', 'the', 'is', 'in', 'for', 'with', 'not', 'a', 'that', 'this', 'will', 'can', 'must', 'want', 'may', 'have', 'are', 'be', 'go', 'come', 'see', 'do', 'let', 'keep', 'give', 'bring', 'say', 'become', 'make'];
    
    $scores = [
        'fr' => 0,
        'nl' => 0, 
        'en' => 0
    ];
    
    // Count keyword matches
    $words = preg_split('/\s+/', $text);
    foreach ($words as $word) {
        if (in_array($word, $french_keywords)) $scores['fr']++;
        if (in_array($word, $dutch_keywords)) $scores['nl']++;
        if (in_array($word, $english_keywords)) $scores['en']++;
    }
    
    // Check for specific language patterns
    if (preg_match('/[àâäéèêëïîôöùûüÿç]/', $text)) $scores['fr'] += 2; // French accents
    if (preg_match('/[áéíóúñü]/', $text)) $scores['nl'] += 1; // Dutch/Spanish patterns
    if (preg_match('/[áéíóú]/', $text) && !preg_match('/ñ/', $text)) $scores['nl'] += 1; // Dutch without ñ
    
    // Return highest scoring language
    arsort($scores);
    $top_language = key($scores);
    
    // If no clear winner, default to site language
    if ($scores[$top_language] == 0) {
        return get_locale() === 'fr_FR' ? 'fr' : (get_locale() === 'nl_NL' ? 'nl' : 'en');
    }
    
    return $top_language;
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT ALLERGEN SCANNER — Check products for missing ingredient lists
// ═══════════════════════════════════════════════════════════════

function tinyeclipse_scan_product_allergens() {
    if (!class_exists('WooCommerce')) return [];
    
    $products = wc_get_products(['limit' => -1, 'status' => 'publish']);
    $missing_allergens = [];
    $allergen_keywords = [
        'en' => ['allergens', 'ingredients', 'contains', 'may contain traces'],
        'nl' => ['allergenen', 'ingredienten', 'bevat', 'kan sporen bevatten'],
        'fr' => ['allergènes', 'ingrédients', 'contient', 'peut contenir des traces'],
        'de' => ['allergene', 'zutaten', 'enthält', 'kann spuren von']
    ];
    
    foreach ($products as $product) {
        $description = $product->get_description() . ' ' . $product->get_short_description();
        $has_allergen_info = false;
        
        // Check for allergen keywords in any language
        foreach ($allergen_keywords as $lang => $keywords) {
            foreach ($keywords as $keyword) {
                if (stripos($description, $keyword) !== false) {
                    $has_allergen_info = true;
                    break 2;
                }
            }
        }
        
        // Also check for common allergens
        $common_allergens = ['gluten', 'wheat', 'tarwe', 'blé', 'weizen', 'soy', 'soja', 'soja', 'soja', 'milk', 'melk', 'lait', 'milch', 'sesame', 'sesam', 'sésame', 'sesam', 'pistachio', 'pistache', 'pistache', 'pistazien', 'almond', 'amandel', 'amande', 'mandel', 'peanut', 'pinda', 'arachide', 'erdnuss', 'hazelnut', 'hazelnoot', 'noisette', 'haselnuss'];
        
        foreach ($common_allergens as $allergen) {
            if (stripos($description, $allergen) !== false) {
                $has_allergen_info = true;
                break;
            }
        }
        
        if (!$has_allergen_info) {
            $missing_allergens[] = [
                'id' => $product->get_id(),
                'name' => $product->get_name(),
                'url' => get_edit_post_link($product->get_id()),
                'sku' => $product->get_sku(),
                'price' => $product->get_price(),
                'stock' => $product->get_stock_status()
            ];
        }
    }
    
    return $missing_allergens;
}

function tinyeclipse_get_product_allergen_report() {
    $missing = tinyeclipse_scan_product_allergens();
    $total_products = wc_get_products(['limit' => -1, 'status' => 'publish'])->count();
    $missing_count = count($missing);
    $compliance_rate = $total_products > 0 ? round((($total_products - $missing_count) / $total_products) * 100, 1) : 0;
    
    return [
        'total_products' => $total_products,
        'missing_allergens' => $missing_count,
        'compliance_rate' => $compliance_rate,
        'missing_products' => $missing,
        'last_scan' => tinyeclipse_format_datetime()
    ];
}

// ═══════════════════════════════════════════════════════════════
// OPENING HOURS SCANNER — Index Google Business + ACF settings
// ═══════════════════════════════════════════════════════════════

function tinyeclipse_get_opening_hours() {
    $hours = [];
    
    // 1. Check ACF opening hours settings
    if (function_exists('get_field')) {
        $acf_hours = get_field('opening_hours', 'option');
        if ($acf_hours) {
            $hours['source'] = 'ACF Settings';
            $hours['data'] = $acf_hours;
            $hours['url'] = admin_url('options-general.php?page=opening-hours-settings');
            return $hours;
        }
    }
    
    // 2. Check WordPress opening hours options
    $wp_hours = get_option('opening_hours');
    if ($wp_hours) {
        $hours['source'] = 'WordPress Options';
        $hours['data'] = $wp_hours;
        $hours['url'] = admin_url('options-general.php?page=opening-hours-settings');
        return $hours;
    }
    
    // 3. Check Google Business data (if available via API or stored)
    $google_hours = get_option('google_business_hours');
    if ($google_hours) {
        $hours['source'] = 'Google Business';
        $hours['data'] = $google_hours;
        $hours['url'] = 'https://business.google.com';
        return $hours;
    }
    
    // 4. Try to extract from site content/pages
    $content_hours = tinyeclipse_extract_opening_hours_from_content();
    if ($content_hours) {
        $hours['source'] = 'Site Content';
        $hours['data'] = $content_hours;
        $hours['url'] = get_home_url();
        return $hours;
    }
    
    // 5. Default to standard Belgian business hours
    $hours['source'] = 'Default (Belgian Business Hours)';
    $hours['data'] = [
        'monday' => '09:00 - 18:00',
        'tuesday' => '09:00 - 18:00', 
        'wednesday' => '09:00 - 18:00',
        'thursday' => '09:00 - 18:00',
        'friday' => '09:00 - 18:00',
        'saturday' => '09:00 - 17:00',
        'sunday' => 'gesloten'
    ];
    $hours['url'] = admin_url('options-general.php?page=opening-hours-settings');
    
    return $hours;
}

function tinyeclipse_extract_opening_hours_from_content() {
    // Search for opening hours in pages/posts
    $args = [
        'post_type' => ['page', 'post'],
        'post_status' => 'publish',
        'posts_per_page' => 20,
        's' => 'openingsuur'
    ];
    
    $query = new WP_Query($args);
    $hours_found = [];
    
    if ($query->have_posts()) {
        while ($query->have_posts()) {
            $query->the_post();
            $content = get_the_content();
            
            // Look for common opening hour patterns
            $patterns = [
                '/(\w+dag)\s*:?\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i',
                '/(\w+dag)\s*:?\s*(gesloten|closed)/i',
                '/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i'
            ];
            
            foreach ($patterns as $pattern) {
                if (preg_match_all($pattern, $content, $matches)) {
                    $hours_found = array_merge($hours_found, $matches[0]);
                }
            }
        }
        wp_reset_postdata();
    }
    
    return !empty($hours_found) ? $hours_found : null;
}

function tinyeclipse_format_opening_hours_response($lang = 'nl') {
    $hours = tinyeclipse_get_opening_hours();
    $data = $hours['data'];
    
    if (!is_array($data)) {
        return $data; // Return raw string if not array
    }
    
    $days = [
        'nl' => ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'],
        'fr' => ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
        'en' => ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    ];
    
    $response = "Openingstijden:\n";
    $selected_days = $days[$lang] ?? $days['nl'];
    
    foreach ($selected_days as $index => $day) {
        $day_key = strtolower($day);
        $hours_text = isset($data[$day_key]) ? $data[$day_key] : (isset($data[$index]) ? $data[$index] : 'Niet beschikbaar');
        $response .= ucfirst($day) . ": " . $hours_text . "\n";
    }
    
    return $response;
}

// ═══════════════════════════════════════════════════════════════
// ORDER LOOKUP + VERIFICATION — Auto-detect + unique verification
// ═══════════════════════════════════════════════════════════════

function tinyeclipse_find_order_by_number($order_number) {
    if (!class_exists('WooCommerce')) return null;
    
    // Try exact match first
    $order = wc_get_order($order_number);
    if ($order) return $order;
    
    // Try with # prefix
    $order = wc_get_order(ltrim($order_number, '#'));
    if ($order) return $order;
    
    // Search by order number in meta
    $args = [
        'post_type' => 'shop_order',
        'post_status' => ['wc-completed', 'wc-processing', 'wc-pending', 'wc-on-hold'],
        'posts_per_page' => 1,
        'meta_query' => [
            'relation' => 'OR',
            ['key' => '_order_number', 'value' => $order_number],
            ['key' => '_billing_order_number', 'value' => $order_number],
        ]
    ];
    
    $query = new WP_Query($args);
    if ($query->have_posts()) {
        return wc_get_order($query->posts[0]->ID);
    }
    
    return null;
}

function tinyeclipse_generate_order_verification_question($order) {
    if (!$order) return null;
    
    $order_id = $order->get_id();
    $order_number = $order->get_order_number();
    $billing_email = $order->get_billing_email();
    $billing_phone = $order->get_billing_phone();
    $billing_city = $order->get_billing_city();
    $billing_postcode = $order->get_billing_postcode();
    $order_date = $order->get_date_created();
    $total = $order->get_total();
    
    // Generate unique verification questions
    $questions = [];
    
    // 1. Amount + city
    if ($total && $billing_city) {
        $questions[] = "Wat was het totaalbedrag van €" . number_format($total, 2) . " en naar welke stad is de bestelling verzonden?";
    }
    
    // 2. Order date + postcode
    if ($order_date && $billing_postcode) {
        $date = tinyeclipse_format_date($order_date->getTimestamp());
        $questions[] = "Op welke datum (" . $date . ") is de bestelling geplaatst en wat is de eerste 2 cijfers van de postcode?";
    }
    
    // 3. Last 4 digits of phone + product count
    if ($billing_phone) {
        $items_count = $order->get_items_count();
        $phone_last4 = substr(preg_replace('/[^0-9]/', '', $billing_phone), -4);
        $questions[] = "Wat zijn de laatste 4 cijfers van het telefoonnummer en hoeveel producten zijn er besteld (" . $items_count . ")?";
    }
    
    // 4. Email domain + order number pattern
    if ($billing_email) {
        $domain = substr(strrchr($billing_email, "@"), 1);
        $questions[] = "Wat is het domein van het e-mailadres en welk patroon heeft het bestelnummer (#" . $order_number . ")?";
    }
    
    // Return random question
    if (!empty($questions)) {
        return $questions[array_rand($questions)];
    }
    
    return "Kan u de bestelling bevestigen met de bestelnummer #" . $order_number . " en het e-mailadres dat gebruikt is?";
}

function tinyeclipse_get_order_summary_for_ai($order) {
    if (!$order) return null;
    
    $items = [];
    foreach ($order->get_items() as $item) {
        $product = $item->get_product();
        $items[] = [
            'name' => $product->get_name(),
            'quantity' => $item->get_quantity(),
            'price' => $item->get_total(),
            'sku' => $product->get_sku()
        ];
    }
    
    return [
        'order_number' => $order->get_order_number(),
        'status' => $order->get_status(),
        'date' => tinyeclipse_format_date($order->get_date_created()->getTimestamp()),
        'total' => $order->get_total(),
        'customer' => [
            'name' => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
            'email' => $order->get_billing_email(),
            'phone' => $order->get_billing_phone(),
            'city' => $order->get_billing_city(),
            'postcode' => $order->get_billing_postcode()
        ],
        'items' => $items,
        'payment_method' => $order->get_payment_method_title(),
        'shipping_method' => $order->get_shipping_method_title(),
        'notes' => $order->get_customer_note()
    ];
}

// ═══════════════════════════════════════════════════════════════
// CLICKABLE STATS & DRILL-DOWN — All stats clickable with detailed lists
// ═══════════════════════════════════════════════════════════════

function tinyeclipse_get_clickable_stats() {
    global $wpdb;
    
    $stats = [];
    
    // Basic WordPress stats
    $stats['pages'] = [
        'count' => wp_count_posts('page')->publish,
        'label' => 'Pagina\'s',
        'icon' => '📄',
        'url' => admin_url('edit.php?post_type=page'),
        'drilldown' => tinyeclipse_get_recent_pages(5)
    ];
    
    $stats['posts'] = [
        'count' => wp_count_posts('post')->publish,
        'label' => 'Berichten',
        'icon' => '📝',
        'url' => admin_url('edit.php'),
        'drilldown' => tinyeclipse_get_recent_posts(5)
    ];
    
    $stats['users'] = [
        'count' => count_users()['total_users'],
        'label' => 'Gebruikers',
        'icon' => '👥',
        'url' => admin_url('users.php'),
        'drilldown' => tinyeclipse_get_recent_users(5)
    ];
    
    $stats['comments'] = [
        'count' => wp_count_comments()->approved,
        'label' => 'Reacties',
        'icon' => '💬',
        'url' => admin_url('edit-comments.php?comment_status=approved'),
        'drilldown' => tinyeclipse_get_recent_comments(5)
    ];
    
    // WooCommerce stats
    if (class_exists('WooCommerce')) {
        $stats['products'] = [
            'count' => wp_count_posts('product')->publish,
            'label' => 'Producten',
            'icon' => '🛍️',
            'url' => admin_url('edit.php?post_type=product'),
            'drilldown' => tinyeclipse_get_recent_products(5)
        ];
        
        $stats['orders'] = [
            'count' => wp_count_posts('shop_order')->{'wc-completed'} ?? 0,
            'label' => 'Bestellingen',
            'icon' => '📦',
            'url' => admin_url('edit.php?post_type=shop_order&post_status=wc-completed'),
            'drilldown' => tinyeclipse_get_recent_orders(5)
        ];
    }
    
    // TinyEclipse specific stats
    $stats['leads'] = [
        'count' => $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}tinyeclipse_leads"),
        'label' => 'Leads',
        'icon' => '🎯',
        'url' => admin_url('admin.php?page=tinyeclipse-leads'),
        'drilldown' => tinyeclipse_get_recent_leads(5)
    ];
    
    $stats['forms'] = [
        'count' => $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}tinyeclipse_forms"),
        'label' => 'Formulieren',
        'icon' => '📝',
        'url' => admin_url('admin.php?page=tinyeclipse-forms'),
        'drilldown' => tinyeclipse_get_recent_form_submissions(5)
    ];
    
    $stats['tokens'] = [
        'count' => $wpdb->get_var("SELECT SUM(balance) FROM {$wpdb->prefix}tinyeclipse_tokens"),
        'label' => 'Tokens',
        'icon' => '🪙',
        'url' => admin_url('admin.php?page=tinyeclipse-tokens'),
        'drilldown' => tinyeclipse_get_token_balances(5)
    ];
    
    return $stats;
}

// Drill-down helper functions
function tinyeclipse_get_recent_pages($limit = 5) {
    $pages = get_posts(['post_type' => 'page', 'numberposts' => $limit, 'orderby' => 'date', 'order' => 'DESC']);
    $result = [];
    foreach ($pages as $page) {
        $result[] = [
            'id' => $page->ID,
            'title' => $page->post_title,
            'url' => get_edit_post_link($page->ID),
            'date' => tinyeclipse_format_date(strtotime($page->post_date)),
            'status' => $page->post_status
        ];
    }
    return $result;
}

function tinyeclipse_get_recent_products($limit = 5) {
    if (!class_exists('WooCommerce')) return [];
    
    $products = wc_get_products(['limit' => $limit, 'orderby' => 'date_created', 'order' => 'DESC']);
    $result = [];
    foreach ($products as $product) {
        $result[] = [
            'id' => $product->get_id(),
            'name' => $product->get_name(),
            'url' => get_edit_post_link($product->get_id()),
            'price' => $product->get_price(),
            'stock' => $product->get_stock_status(),
            'date' => tinyeclipse_format_date($product->get_date_created()->getTimestamp())
        ];
    }
    return $result;
}

function tinyeclipse_get_recent_orders($limit = 5) {
    if (!class_exists('WooCommerce')) return [];
    
    $orders = wc_get_orders(['limit' => $limit, 'orderby' => 'date_created', 'order' => 'DESC']);
    $result = [];
    foreach ($orders as $order) {
        $result[] = [
            'id' => $order->get_id(),
            'number' => $order->get_order_number(),
            'url' => admin_url('post.php?post=' . $order->get_id() . '&action=edit'),
            'total' => $order->get_total(),
            'status' => $order->get_status(),
            'customer' => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
            'date' => tinyeclipse_format_date($order->get_date_created()->getTimestamp())
        ];
    }
    return $result;
}

function tinyeclipse_get_recent_leads($limit = 5) {
    global $wpdb;
    $table = $wpdb->prefix . 'tinyeclipse_leads';
    $leads = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$table} ORDER BY created_at DESC LIMIT %d", $limit));
    
    $result = [];
    foreach ($leads as $lead) {
        $result[] = [
            'id' => $lead->id,
            'email' => $lead->email,
            'name' => $lead->name,
            'phone' => $lead->phone,
            'source' => $lead->source,
            'date' => tinyeclipse_format_datetime(strtotime($lead->created_at))
        ];
    }
    return $result;
}

function tinyeclipse_is_superadmin() {
    if (!is_user_logged_in()) return false;
    $user = wp_get_current_user();
    if (!$user->has_cap('manage_options')) return false;
    $email = $user->user_email;
    $domains = ['@digitalfarmers.be', '@digitalfarmers.nl', '@tinyeclipse.'];
    foreach ($domains as $d) {
        if (strpos($email, $d) !== false) return true;
    }
    return false;
}

function tinyeclipse_is_shop_manager() {
    if (!is_user_logged_in()) return false;
    $user = wp_get_current_user();
    if (in_array('shop_manager', $user->roles)) return true;
    if ($user->has_cap('manage_woocommerce') && !$user->has_cap('manage_options')) return true;
    return false;
}

function tinyeclipse_get_eclipse_cap() {
    return 'manage_woocommerce';
}

// ═══════════════════════════════════════════════════════════════
// TOKEN SYSTEM — Global helpers
// ═══════════════════════════════════════════════════════════════

function tinyeclipse_get_token_balance($user_id = 0) {
    if (!$user_id) $user_id = get_current_user_id();
    if (!$user_id) return ['balance' => 0, 'tier' => 'free', 'lifetime_used' => 0];

    if (class_exists('TinyEclipse_Tokens')) {
        return TinyEclipse_Tokens::instance()->get_balance($user_id);
    }
    return ['balance' => 0, 'tier' => 'free', 'lifetime_used' => 0];
}

function tinyeclipse_deduct_tokens($action, $user_id = 0) {
    if (!$user_id) $user_id = get_current_user_id();
    if (!$user_id) return new WP_Error('no_user', 'No user');

    if (class_exists('TinyEclipse_Tokens')) {
        return TinyEclipse_Tokens::instance()->deduct($action, $user_id);
    }
    return new WP_Error('no_tokens', 'Token system not loaded');
}

// ═══════════════════════════════════════════════════════════════
// LOAD MODULE CLASSES
// ═══════════════════════════════════════════════════════════════

$te_includes = TINYECLIPSE_PLUGIN_DIR . 'includes/';

require_once $te_includes . 'class-tinyeclipse-hub.php';
require_once $te_includes . 'class-tinyeclipse-security.php';
require_once $te_includes . 'class-tinyeclipse-seo.php';
require_once $te_includes . 'class-tinyeclipse-mail.php';
require_once $te_includes . 'class-tinyeclipse-collector.php';
require_once $te_includes . 'class-tinyeclipse-translation.php';
require_once $te_includes . 'class-tinyeclipse-translator.php';
require_once $te_includes . 'class-tinyeclipse-jobs.php';
require_once $te_includes . 'class-tinyeclipse-forms.php';
require_once $te_includes . 'class-tinyeclipse-tokens.php';
require_once $te_includes . 'class-tinyeclipse-rest-api.php';

if (is_admin()) {
    require_once $te_includes . 'class-tinyeclipse-admin.php';
}

// ═══════════════════════════════════════════════════════════════
// INIT ALL MODULES
// ═══════════════════════════════════════════════════════════════

add_action('init', function () {
    TinyEclipse_Hub::instance();
    TinyEclipse_Security::instance();
    TinyEclipse_SEO::instance();
    TinyEclipse_Mail::instance();
    TinyEclipse_Collector::instance();
    TinyEclipse_Translation::instance();
    TinyEclipse_Translator::instance();
    TinyEclipse_Jobs::instance();
    TinyEclipse_Forms::instance();
    TinyEclipse_Tokens::instance();

    if (is_admin()) {
        TinyEclipse_Admin::instance();
    }

    do_action('tinyeclipse_loaded');
}, 5);

// REST routes
add_action('rest_api_init', function () {
    TinyEclipse_REST_API::register_routes();
});

// ═══════════════════════════════════════════════════════════════
// CRON JOBS
// ═══════════════════════════════════════════════════════════════

add_filter('cron_schedules', function ($schedules) {
    $schedules['tinyeclipse_hourly'] = ['interval' => 3600, 'display' => 'Hourly (TinyEclipse)'];
    return $schedules;
});

add_action('init', function () {
    if (!wp_next_scheduled('tinyeclipse_hourly_scan')) {
        wp_schedule_event(time(), 'tinyeclipse_hourly', 'tinyeclipse_hourly_scan');
    }
    if (!wp_next_scheduled('tinyeclipse_daily_report')) {
        wp_schedule_event(time(), 'daily', 'tinyeclipse_daily_report');
    }
    if (!wp_next_scheduled('tinyeclipse_command_poll')) {
        wp_schedule_event(time(), 'tinyeclipse_hourly', 'tinyeclipse_command_poll');
    }
});

add_action('tinyeclipse_hourly_scan', function () {
    if (class_exists('TinyEclipse_Collector')) {
        TinyEclipse_Collector::instance()->run_hourly_scan();
    }
});

add_action('tinyeclipse_daily_report', function () {
    if (class_exists('TinyEclipse_Collector')) {
        TinyEclipse_Collector::instance()->run_daily_report();
    }
});

add_action('tinyeclipse_command_poll', function () {
    if (class_exists('TinyEclipse_Hub')) {
        TinyEclipse_Hub::instance()->poll_commands();
    }
});

// ═══════════════════════════════════════════════════════════════
// MODULE EVENT HOOKS — Forms, Jobs, etc.
// ═══════════════════════════════════════════════════════════════

add_action('fluentform/submission_inserted', function ($submission_id, $form_data, $form) {
    $form_title = isset($form->title) ? $form->title : 'Formulier';
    $name = $email = '';
    foreach (['name', 'naam', 'full_name', 'your-name'] as $key) { if (!empty($form_data[$key])) { $name = $form_data[$key]; break; } }
    foreach (['email', 'e-mail', 'your-email', 'mail'] as $key) { if (!empty($form_data[$key])) { $email = $form_data[$key]; break; } }
    $desc = $name ? "Door {$name}" : '';
    if ($email && $desc) $desc .= " ({$email})"; elseif ($email) $desc = $email;
    tinyeclipse_send_event('forms', 'form_submitted', "Formulier ingevuld: {$form_title}", $desc, [
        'form_id' => isset($form->id) ? $form->id : null, 'form_title' => $form_title,
        'submission_id' => $submission_id, 'name' => $name, 'email' => $email, 'field_count' => count($form_data),
    ]);
}, 10, 3);

add_action('wpcf7_mail_sent', function ($contact_form) {
    $submission = class_exists('WPCF7_Submission') ? WPCF7_Submission::get_instance() : null;
    $data = $submission ? $submission->get_posted_data() : [];
    $form_title = $contact_form->title();
    $name = $email = '';
    foreach (['your-name', 'name', 'naam'] as $key) { if (!empty($data[$key])) { $name = $data[$key]; break; } }
    foreach (['your-email', 'email', 'e-mail'] as $key) { if (!empty($data[$key])) { $email = $data[$key]; break; } }
    $desc = $name ? "Door {$name}" : '';
    if ($email && $desc) $desc .= " ({$email})"; elseif ($email) $desc = $email;
    tinyeclipse_send_event('forms', 'form_submitted', "Contactformulier: {$form_title}", $desc, [
        'form_id' => $contact_form->id(), 'form_title' => $form_title, 'name' => $name, 'email' => $email,
    ]);
});

add_action('new_job_application', function ($application_id, $job_id) {
    $job = get_post($job_id);
    $applicant = get_post($application_id);
    tinyeclipse_send_event('jobs', 'job_application', "Sollicitatie: " . ($job ? $job->post_title : 'Onbekend'),
        "Door " . ($applicant ? $applicant->post_title : 'Onbekend'), [
        'application_id' => $application_id, 'job_id' => $job_id,
    ], get_permalink($job_id));
}, 10, 2);

add_action('publish_job_listing', function ($post_id) {
    $job = get_post($post_id);
    if ($job) tinyeclipse_send_event('jobs', 'job_published', "Vacature: {$job->post_title}", '', ['job_id' => $post_id], get_permalink($post_id));
});

add_action('gform_after_submission', function ($entry, $form) {
    $title = isset($form['title']) ? $form['title'] : 'Formulier';
    tinyeclipse_send_event('forms', 'form_submitted', "Formulier: {$title}", '', [
        'form_id' => $form['id'] ?? null, 'form_title' => $title, 'entry_id' => $entry['id'] ?? null,
    ]);
}, 10, 2);

// ═══════════════════════════════════════════════════════════════
// ACTIVATION / DEACTIVATION / MIGRATION
// ═══════════════════════════════════════════════════════════════

register_activation_hook(__FILE__, function () {
    global $wpdb;
    $charset = $wpdb->get_charset_collate();
    $prefix = $wpdb->prefix;

    // Create DB tables
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';

    dbDelta("CREATE TABLE {$prefix}tinyeclipse_logs (
        id BIGINT UNSIGNED AUTO_INCREMENT,
        module VARCHAR(50) NOT NULL DEFAULT 'core',
        level VARCHAR(20) NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        context TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_module (module),
        KEY idx_level (level),
        KEY idx_created (created_at)
    ) {$charset};");

    dbDelta("CREATE TABLE {$prefix}tinyeclipse_reports (
        id BIGINT UNSIGNED AUTO_INCREMENT,
        report_type VARCHAR(50) NOT NULL DEFAULT 'daily',
        data LONGTEXT NOT NULL,
        score INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_type (report_type),
        KEY idx_created (created_at)
    ) {$charset};");

    dbDelta("CREATE TABLE {$prefix}tinyeclipse_mail_log (
        id BIGINT UNSIGNED AUTO_INCREMENT,
        to_email VARCHAR(255) NOT NULL,
        subject VARCHAR(500) DEFAULT '',
        status VARCHAR(20) DEFAULT 'sent',
        provider VARCHAR(50) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_created (created_at)
    ) {$charset};");

    dbDelta("CREATE TABLE {$prefix}tinyeclipse_security (
        id BIGINT UNSIGNED AUTO_INCREMENT,
        check_type VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pass',
        details TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_type (check_type),
        KEY idx_created (created_at)
    ) {$charset};");

    dbDelta("CREATE TABLE {$prefix}tinyeclipse_tokens (
        user_id BIGINT UNSIGNED NOT NULL,
        balance INT NOT NULL DEFAULT 0,
        lifetime_used INT NOT NULL DEFAULT 0,
        tier VARCHAR(20) NOT NULL DEFAULT 'free',
        monthly_reset DATE DEFAULT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id)
    ) {$charset};");

    dbDelta("CREATE TABLE {$prefix}tinyeclipse_token_log (
        id BIGINT UNSIGNED AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        action VARCHAR(50) NOT NULL,
        tokens_used INT NOT NULL DEFAULT 0,
        balance_after INT NOT NULL DEFAULT 0,
        description VARCHAR(255) DEFAULT '',
        meta TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_user (user_id),
        KEY idx_created (created_at)
    ) {$charset};");

    // Default options
    add_option('tinyeclipse_enabled', false);
    add_option('tinyeclipse_color', '#6C3CE1');
    add_option('tinyeclipse_lang', 'nl');
    add_option('tinyeclipse_position', 'bottom-right');
    add_option('tinyeclipse_exclude_roles', ['administrator']);
    add_option('tinyeclipse_modules', []);
    add_option('tinyeclipse_auto_report', true);
    add_option('tinyeclipse_log_retention', 30);

    // Auto-onboarding - generate tenant ID and register with Hub
    tinyeclipse_auto_onboard();

    // Migrate from eclipse_ai_* if exists
    tinyeclipse_migrate_from_eclipse_ai();

    // Flush rewrite rules
    flush_rewrite_rules();
});

register_deactivation_hook(__FILE__, function () {
    wp_clear_scheduled_hook('tinyeclipse_hourly_scan');
    wp_clear_scheduled_hook('tinyeclipse_daily_report');
    wp_clear_scheduled_hook('tinyeclipse_command_poll');
});

function tinyeclipse_migrate_from_eclipse_ai() {
    global $wpdb;

    // Migrate options
    $option_map = [
        'eclipse_ai_hub_url'           => 'tinyeclipse_hub_url',
        'eclipse_ai_hub_api_key'       => 'tinyeclipse_hub_api_key',
        'eclipse_ai_site_id'           => 'tinyeclipse_site_id',
        'eclipse_ai_modules'           => 'tinyeclipse_modules',
        'eclipse_ai_report_email'      => 'tinyeclipse_report_email',
        'eclipse_ai_auto_report'       => 'tinyeclipse_auto_report',
        'eclipse_ai_log_retention'     => 'tinyeclipse_log_retention',
        'eclipse_ai_translate_key'     => 'tinyeclipse_translate_key',
        'eclipse_ai_translate_provider' => 'tinyeclipse_translate_provider',
        'eclipse_ai_translate_model'   => 'tinyeclipse_translate_model',
    ];

    foreach ($option_map as $old => $new) {
        $val = get_option($old);
        if ($val !== false && get_option($new) === false) {
            update_option($new, $val);
            tinyeclipse_log('migration', 'info', "Migrated option {$old} → {$new}");
        }
    }

    // Migrate DB tables
    $table_map = [
        'eclipse_ai_logs'      => 'tinyeclipse_logs',
        'eclipse_ai_reports'   => 'tinyeclipse_reports',
        'eclipse_ai_mail_log'  => 'tinyeclipse_mail_log',
        'eclipse_ai_security'  => 'tinyeclipse_security',
        'eclipse_ai_tokens'    => 'tinyeclipse_tokens',
        'eclipse_ai_token_log' => 'tinyeclipse_token_log',
    ];

    foreach ($table_map as $old_suffix => $new_suffix) {
        $old_table = $wpdb->prefix . $old_suffix;
        $new_table = $wpdb->prefix . $new_suffix;
        if ($wpdb->get_var("SHOW TABLES LIKE '{$old_table}'") === $old_table) {
            $count = $wpdb->get_var("SELECT COUNT(*) FROM {$old_table}");
            if ($count > 0) {
                $new_count = $wpdb->get_var("SELECT COUNT(*) FROM {$new_table}");
                if ($new_count == 0) {
                    $wpdb->query("INSERT INTO {$new_table} SELECT * FROM {$old_table}");
                    tinyeclipse_log('migration', 'info', "Migrated {$count} rows from {$old_table} → {$new_table}");
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// AUTO-ONBOARDING — Zero-config setup with automatic Hub registration
// ═══════════════════════════════════════════════════════════════

function tinyeclipse_auto_onboard() {
    // Only onboard once
    if (get_option('tinyeclipse_onboarded', false)) {
        return;
    }

    // Generate unique tenant ID
    $tenant_id = wp_generate_uuid();
    update_option('tinyeclipse_site_id', $tenant_id);
    update_option('tinyeclipse_tenant_id', $tenant_id);

    // Prepare fingerprint data
    $fingerprint = [
        'site_url' => get_site_url(),
        'site_name' => get_bloginfo('name'),
        'description' => get_bloginfo('description'),
        'wp_version' => get_bloginfo('version'),
        'php_version' => phpversion(),
        'locale' => get_locale(),
        'timezone' => wp_timezone_string(),
        'environment' => tinyeclipse_is_staging() ? 'staging' : 'production',
        'admin_email' => get_option('admin_email'),
        'tenant_id' => $tenant_id,
        'generated_at' => current_time('c'),
        'connector_version' => TINYECLIPSE_VERSION
    ];

    // Detect plugins
    $active_plugins = get_option('active_plugins', []);
    $fingerprint['plugins'] = array_map(function($p) {
        return explode('/', $p)[0];
    }, $active_plugins);
    
    $fingerprint['plugin_count'] = count($active_plugins);
    
    // Detect modules
    $modules = [];
    if (class_exists('WooCommerce')) $modules[] = 'shop';
    if (function_exists('icl_get_languages')) $modules[] = 'wpml';
    if (function_exists('wpFluent') || in_array('fluentform', $fingerprint['plugins'])) $modules[] = 'forms';
    if (in_array('wp-job-manager', $fingerprint['plugins'])) $modules[] = 'jobs';
    if (in_array('fluent-smtp', $fingerprint['plugins']) || in_array('wp-mail-smtp', $fingerprint['plugins'])) $modules[] = 'mail';
    if (in_array('wordpress-seo', $fingerprint['plugins']) || in_array('rank-math', $fingerprint['plugins'])) $modules[] = 'seo';
    
    $fingerprint['modules'] = $modules;

    // Register with Hub
    $response = wp_remote_post(TINYECLIPSE_API_BASE . '/api/sites/auto-onboard', [
        'timeout' => 15,
        'headers' => [
            'Content-Type' => 'application/json',
            'User-Agent' => 'TinyEclipse-Connector/' . TINYECLIPSE_VERSION
        ],
        'body' => wp_json_encode($fingerprint)
    ]);

    if (!is_wp_error($response)) {
        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        if (!empty($body['success']) && !empty($body['api_key'])) {
            // Store API key from Hub
            update_option('tinyeclipse_hub_api_key', $body['api_key']);
            update_option('tinyeclipse_hub_url', TINYECLIPSE_HUB_URL);
            
            // Mark as onboarded
            update_option('tinyeclipse_onboarded', true);
            update_option('tinyeclipse_onboarded_at', current_time('mysql'));
            
            // Log successful onboarding
            tinyeclipse_log('onboarding', 'info', 'Auto-onboarding successful', [
                'tenant_id' => $tenant_id,
                'hub_response' => $body
            ]);
            
            // Start heartbeat immediately
            wp_schedule_single_event(time(), 'tinyeclipse_heartbeat_now');
            
        } else {
            // Onboarding failed, but we have tenant ID
            tinyeclipse_log('onboarding', 'warning', 'Auto-onboarding failed, using local mode', [
                'tenant_id' => $tenant_id,
                'response' => $body
            ]);
            update_option('tinyeclipse_onboarded', true); // Don't retry
        }
    } else {
        // Network error
        tinyeclipse_log('onboarding', 'error', 'Auto-onboarding network error', [
            'tenant_id' => $tenant_id,
            'error' => $response->get_error_message()
        ]);
        update_option('tinyeclipse_onboarded', true); // Don't retry
    }
}

// Add immediate heartbeat action
add_action('tinyeclipse_heartbeat_now', function() {
    TinyEclipse_Hub::instance()->maybe_heartbeat();
});

// Schedule knowledge sync
add_action('tinyeclipse_hourly_scan', function() {
    // Auto-sync knowledge base every hour
    if (get_option('tinyeclipse_auto_knowledge_sync', true)) {
        TinyEclipse_Collector::instance()->sync_knowledge_to_hub();
    }
});

// Add manual sync action
add_action('tinyeclipse_manual_knowledge_sync', function() {
    return TinyEclipse_Collector::instance()->sync_knowledge_to_hub(true);
});
