<?php
/**
 * Plugin Name: TinyEclipse WC
 * Plugin URI: https://tinyeclipse.digitalfarmers.be
 * Description: WooCommerce integration for TinyEclipse — Orders, Products, Customer Retention, Abandoned Carts & Shop Intelligence by Digital Farmers.
 * Version: 1.0.0
 * Author: Digital Farmers
 * Author URI: https://digitalfarmers.be
 * License: GPL v2 or later
 * Text Domain: tinyeclipse-wc
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * Requires Plugins: tinyeclipse-connector
 */

if (!defined('ABSPATH')) exit;

define('TINYECLIPSE_WC_VERSION', '1.0.0');
define('TINYECLIPSE_WC_DIR', plugin_dir_path(__FILE__));

// Load Sync Agent
if (file_exists(TINYECLIPSE_WC_DIR . 'includes/class-tinyeclipse-sync-agent.php')) {
    require_once TINYECLIPSE_WC_DIR . 'includes/class-tinyeclipse-sync-agent.php';
    add_action('plugins_loaded', function () {
        if (class_exists('WooCommerce') && class_exists('TinyEclipse_Sync_Agent')) {
            TinyEclipse_Sync_Agent::instance();
        }
    }, 20);
}

// ─── Dependency Check ───
add_action('admin_init', function () {
    if (!function_exists('tinyeclipse_send_event')) {
        deactivate_plugins(plugin_basename(__FILE__));
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p><strong>TinyEclipse WC</strong> vereist de <strong>TinyEclipse Connector</strong> plugin. Installeer en activeer deze eerst.</p></div>';
        });
        return;
    }
    if (!class_exists('WooCommerce')) {
        deactivate_plugins(plugin_basename(__FILE__));
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p><strong>TinyEclipse WC</strong> vereist <strong>WooCommerce</strong>. Installeer en activeer WooCommerce eerst.</p></div>';
        });
        return;
    }
});

// ═══════════════════════════════════════════════════════════════
// ORDER EVENTS — Real-time order tracking to Eclipse Hub
// ═══════════════════════════════════════════════════════════════

// ─── New Order ───
add_action('woocommerce_new_order', function ($order_id) {
    if (!function_exists('tinyeclipse_send_event')) return;
    if (!function_exists('wc_get_order')) return;
    $order = wc_get_order($order_id);
    if (!$order) return;

    $total = $order->get_total();
    $items = $order->get_item_count();
    $billing_name = $order->get_billing_first_name() . ' ' . $order->get_billing_last_name();
    $email = $order->get_billing_email();

    tinyeclipse_send_event('shop', 'order_placed',
        "Nieuwe bestelling #{$order_id} — €{$total}",
        "{$items} artikel(en) door {$billing_name}",
        [
            'order_id'     => $order_id,
            'total'        => (float)$total,
            'currency'     => $order->get_currency(),
            'items'        => $items,
            'customer'     => $billing_name,
            'email'        => $email,
            'status'       => $order->get_status(),
            'payment'      => $order->get_payment_method_title(),
        ],
        $order->get_view_order_url()
    );
});

// ─── Order Completed ───
add_action('woocommerce_order_status_completed', function ($order_id) {
    if (!function_exists('tinyeclipse_send_event')) return;
    if (!function_exists('wc_get_order')) return;
    $order = wc_get_order($order_id);
    if (!$order) return;

    tinyeclipse_send_event('shop', 'order_completed',
        "Bestelling #{$order_id} afgerond — €" . $order->get_total(),
        $order->get_item_count() . ' artikel(en)',
        ['order_id' => $order_id, 'total' => (float)$order->get_total()]
    );
});

// ─── Order Refunded ───
add_action('woocommerce_order_status_refunded', function ($order_id) {
    if (!function_exists('tinyeclipse_send_event')) return;
    if (!function_exists('wc_get_order')) return;
    $order = wc_get_order($order_id);
    if (!$order) return;

    tinyeclipse_send_event('shop', 'order_refunded',
        "Bestelling #{$order_id} terugbetaald — €" . $order->get_total(),
        '',
        ['order_id' => $order_id, 'total' => (float)$order->get_total()]
    );
});

// ═══════════════════════════════════════════════════════════════
// ABANDONED CART TRACKING
// ═══════════════════════════════════════════════════════════════

// ─── Track cart updates ───
add_action('woocommerce_cart_updated', function () {
    if (!function_exists('tinyeclipse_get_tenant_id')) return;
    $cart = WC()->cart;
    if (!$cart || $cart->is_empty()) return;

    $session_id = WC()->session ? WC()->session->get_customer_id() : null;
    if (!$session_id) return;

    $cart_data = [
        'items' => [],
        'total' => (float)$cart->get_cart_contents_total(),
        'item_count' => $cart->get_cart_contents_count(),
        'updated_at' => current_time('c'),
    ];

    foreach ($cart->get_cart() as $item) {
        $product = $item['data'];
        $cart_data['items'][] = [
            'product_id' => $item['product_id'],
            'name' => $product ? $product->get_name() : 'Unknown',
            'quantity' => $item['quantity'],
            'price' => (float)($product ? $product->get_price() : 0),
            'total' => (float)$item['line_total'],
        ];
    }

    // Store in transient (expires after 2 hours)
    set_transient('tinyeclipse_cart_' . $session_id, $cart_data, 2 * HOUR_IN_SECONDS);
});

// ─── Detect abandoned carts via WP-Cron ───
add_action('init', function () {
    if (!wp_next_scheduled('tinyeclipse_check_abandoned_carts')) {
        wp_schedule_event(time(), 'tinyeclipse_30min', 'tinyeclipse_check_abandoned_carts');
    }
});

// Custom cron interval: 30 minutes
add_filter('cron_schedules', function ($schedules) {
    $schedules['tinyeclipse_30min'] = [
        'interval' => 1800,
        'display' => 'Every 30 minutes (TinyEclipse)',
    ];
    return $schedules;
});

add_action('tinyeclipse_check_abandoned_carts', function () {
    if (!function_exists('tinyeclipse_send_event')) return;
    if (!function_exists('tinyeclipse_get_tenant_id')) return;

    global $wpdb;

    // Find all tinyeclipse_cart_ transients older than 1 hour
    $transients = $wpdb->get_results(
        "SELECT option_name, option_value FROM {$wpdb->options}
         WHERE option_name LIKE '_transient_tinyeclipse_cart_%'
         AND option_name NOT LIKE '_transient_timeout_%'"
    );

    foreach ($transients as $t) {
        $session_id = str_replace('_transient_tinyeclipse_cart_', '', $t->option_name);
        $cart_data = maybe_unserialize($t->option_value);

        if (!$cart_data || empty($cart_data['items'])) continue;

        $updated = strtotime($cart_data['updated_at'] ?? '');
        if (!$updated || (time() - $updated) < 3600) continue; // Less than 1 hour old

        // Check if an order was placed for this session
        $already_sent = get_transient('tinyeclipse_abandoned_sent_' . $session_id);
        if ($already_sent) continue;

        // Send abandoned cart event
        $item_names = array_map(function ($i) { return $i['name']; }, $cart_data['items']);
        tinyeclipse_send_event('shop', 'cart_abandoned',
            "Winkelwagen verlaten — €" . number_format($cart_data['total'], 2, ',', '.'),
            implode(', ', array_slice($item_names, 0, 3)),
            [
                'session_id'  => $session_id,
                'cart_total'  => $cart_data['total'],
                'item_count'  => $cart_data['item_count'],
                'items'       => $cart_data['items'],
            ]
        );

        // Mark as sent (don't re-send for 24 hours)
        set_transient('tinyeclipse_abandoned_sent_' . $session_id, true, DAY_IN_SECONDS);

        // Clean up the cart transient
        delete_transient('tinyeclipse_cart_' . $session_id);
    }
});

// ─── Clear cart tracking when order is placed ───
add_action('woocommerce_checkout_order_processed', function ($order_id) {
    $session_id = WC()->session ? WC()->session->get_customer_id() : null;
    if ($session_id) {
        delete_transient('tinyeclipse_cart_' . $session_id);
    }
});

// ═══════════════════════════════════════════════════════════════
// PRE-SALE TRACKING — Track purchase intent signals
// ═══════════════════════════════════════════════════════════════

// ─── Add to cart ───
add_action('woocommerce_add_to_cart', function ($cart_item_key, $product_id, $quantity) {
    if (!function_exists('tinyeclipse_send_event')) return;
    $product = wc_get_product($product_id);
    if (!$product) return;

    tinyeclipse_send_event('shop', 'add_to_cart',
        "Product toegevoegd: {$product->get_name()}",
        "{$quantity}x — €" . $product->get_price(),
        [
            'product_id' => $product_id,
            'product_name' => $product->get_name(),
            'quantity' => $quantity,
            'price' => (float)$product->get_price(),
        ],
        $product->get_permalink()
    );
}, 10, 3);

// ─── Remove from cart ───
add_action('woocommerce_remove_cart_item', function ($cart_item_key, $cart) {
    if (!function_exists('tinyeclipse_send_event')) return;
    $item = $cart->removed_cart_contents[$cart_item_key] ?? null;
    if (!$item) return;

    $product = wc_get_product($item['product_id']);
    $name = $product ? $product->get_name() : 'Onbekend product';

    tinyeclipse_send_event('shop', 'remove_from_cart',
        "Product verwijderd: {$name}",
        '',
        [
            'product_id' => $item['product_id'],
            'product_name' => $name,
            'quantity' => $item['quantity'],
        ]
    );
}, 10, 2);

// ─── Coupon applied ───
add_action('woocommerce_applied_coupon', function ($coupon_code) {
    if (!function_exists('tinyeclipse_send_event')) return;

    tinyeclipse_send_event('shop', 'coupon_applied',
        "Kortingscode gebruikt: {$coupon_code}",
        '',
        ['coupon_code' => $coupon_code]
    );
});

// ─── Checkout failure tracking ───
add_action('woocommerce_checkout_order_processed_notification', function ($order_id) {
    // This fires when checkout fails — track the failure
    if (!function_exists('tinyeclipse_send_event')) return;
    $order = wc_get_order($order_id);
    if (!$order) return;

    $status = $order->get_status();
    if (in_array($status, ['failed', 'cancelled'])) {
        $total = $order->get_total();
        $billing_name = $order->get_billing_first_name() . ' ' . $order->get_billing_last_name();

        tinyeclipse_send_event('shop', 'checkout_failed',
            "Checkout mislukt — €{$total}",
            "Door {$billing_name} ({$status})",
            [
                'order_id' => $order_id,
                'total' => (float)$total,
                'status' => $status,
                'customer' => $billing_name,
                'email' => $order->get_billing_email(),
                'payment_method' => $order->get_payment_method_title(),
                'failure_type' => $status === 'failed' ? 'payment_declined' : 'cancelled',
            ]
        );
    }
});

// ─── Payment failed ───
add_action('woocommerce_order_status_failed', function ($order_id) {
    if (!function_exists('tinyeclipse_send_event')) return;
    $order = wc_get_order($order_id);
    if (!$order) return;

    tinyeclipse_send_event('shop', 'payment_failed',
        "Betaling mislukt — €" . $order->get_total(),
        $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
        [
            'order_id' => $order_id,
            'total' => (float)$order->get_total(),
            'email' => $order->get_billing_email(),
            'payment_method' => $order->get_payment_method_title(),
        ]
    );
});

// ═══════════════════════════════════════════════════════════════
// SYNC FILTER — Inject WooCommerce data into core sync
// ═══════════════════════════════════════════════════════════════

add_filter('tinyeclipse_sync_data', function ($data, $tenant_id) {
    if (!class_exists('WooCommerce')) return $data;

    // Orders (last 500)
    $data['orders'] = [];
    $orders = wc_get_orders(['limit' => 500, 'orderby' => 'date', 'order' => 'DESC']);
    foreach ($orders as $o) {
        $data['orders'][] = [
            'order_id' => $o->get_id(), 'status' => $o->get_status(),
            'total' => (float)$o->get_total(), 'currency' => $o->get_currency(),
            'items' => $o->get_item_count(),
            'customer' => trim($o->get_billing_first_name() . ' ' . $o->get_billing_last_name()),
            'email' => $o->get_billing_email(),
            'phone' => $o->get_billing_phone(),
            'city' => $o->get_billing_city(), 'country' => $o->get_billing_country(),
            'address' => $o->get_billing_address_1(),
            'payment' => $o->get_payment_method_title(),
            'created_at' => $o->get_date_created() ? $o->get_date_created()->format('c') : null,
        ];
    }

    // Customers (last 500)
    $data['customers'] = [];
    $customers = get_users(['role' => 'customer', 'number' => 500]);
    foreach ($customers as $u) {
        $data['customers'][] = [
            'user_id' => $u->ID, 'email' => $u->user_email,
            'name' => trim(get_user_meta($u->ID, 'billing_first_name', true) . ' ' . get_user_meta($u->ID, 'billing_last_name', true)),
            'phone' => get_user_meta($u->ID, 'billing_phone', true),
            'city' => get_user_meta($u->ID, 'billing_city', true),
            'country' => get_user_meta($u->ID, 'billing_country', true),
            'order_count' => (int)get_user_meta($u->ID, '_order_count', true),
            'total_spent' => (float)get_user_meta($u->ID, '_money_spent', true),
            'registered' => $u->user_registered,
        ];
    }

    return $data;
}, 10, 2);

// ═══════════════════════════════════════════════════════════════
// REST API — WooCommerce endpoints for Eclipse Hub
// ═══════════════════════════════════════════════════════════════

add_action('rest_api_init', function () {

    // ─── Products overview ───
    register_rest_route('tinyeclipse/v1', '/shop/products', [
        'methods' => 'GET',
        'callback' => function ($request) {
            if (!class_exists('WooCommerce')) {
                return new WP_REST_Response(['active' => false, 'message' => 'WooCommerce not installed'], 200);
            }
            $limit = min((int)($request->get_param('limit') ?: 100), 200);
            $products = wc_get_products([
                'limit' => $limit,
                'status' => 'publish',
                'orderby' => 'date',
                'order' => 'DESC',
            ]);

            $result = [];
            foreach ($products as $p) {
                $result[] = [
                    'id' => $p->get_id(),
                    'name' => $p->get_name(),
                    'slug' => $p->get_slug(),
                    'type' => $p->get_type(),
                    'status' => $p->get_status(),
                    'price' => $p->get_price(),
                    'regular_price' => $p->get_regular_price(),
                    'sale_price' => $p->get_sale_price(),
                    'stock_status' => $p->get_stock_status(),
                    'stock_quantity' => $p->get_stock_quantity(),
                    'total_sales' => $p->get_total_sales(),
                    'categories' => wp_list_pluck($p->get_category_ids() ? get_terms(['taxonomy' => 'product_cat', 'include' => $p->get_category_ids()]) : [], 'name'),
                    'image' => wp_get_attachment_url($p->get_image_id()) ?: null,
                    'url' => $p->get_permalink(),
                    'created_at' => $p->get_date_created() ? $p->get_date_created()->format('c') : null,
                ];
            }

            return new WP_REST_Response([
                'active' => true,
                'total' => count($result),
                'products' => $result,
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Orders overview ───
    register_rest_route('tinyeclipse/v1', '/shop/orders', [
        'methods' => 'GET',
        'callback' => function ($request) {
            if (!class_exists('WooCommerce')) {
                return new WP_REST_Response(['active' => false], 200);
            }
            $limit = min((int)($request->get_param('limit') ?: 50), 200);
            $status = $request->get_param('status') ?: 'any';

            $orders = wc_get_orders([
                'limit' => $limit,
                'status' => $status,
                'orderby' => 'date',
                'order' => 'DESC',
            ]);

            $result = [];
            foreach ($orders as $o) {
                $items = [];
                foreach ($o->get_items() as $item) {
                    $items[] = [
                        'name' => $item->get_name(),
                        'quantity' => $item->get_quantity(),
                        'total' => $item->get_total(),
                    ];
                }
                $result[] = [
                    'id' => $o->get_id(),
                    'status' => $o->get_status(),
                    'total' => $o->get_total(),
                    'currency' => $o->get_currency(),
                    'items_count' => $o->get_item_count(),
                    'items' => $items,
                    'customer' => $o->get_billing_first_name() . ' ' . $o->get_billing_last_name(),
                    'email' => $o->get_billing_email(),
                    'payment_method' => $o->get_payment_method_title(),
                    'created_at' => $o->get_date_created() ? $o->get_date_created()->format('c') : null,
                ];
            }

            return new WP_REST_Response([
                'active' => true,
                'total' => count($result),
                'orders' => $result,
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Shop stats ───
    register_rest_route('tinyeclipse/v1', '/shop/stats', [
        'methods' => 'GET',
        'callback' => function ($request) {
            if (!class_exists('WooCommerce')) {
                return new WP_REST_Response(['active' => false], 200);
            }
            global $wpdb;
            $days = min((int)($request->get_param('days') ?: 30), 365);
            $since = date('Y-m-d H:i:s', strtotime("-{$days} days"));

            // Revenue
            $revenue = $wpdb->get_var($wpdb->prepare(
                "SELECT SUM(meta_value) FROM {$wpdb->postmeta} pm
                 JOIN {$wpdb->posts} p ON p.ID = pm.post_id
                 WHERE pm.meta_key = '_order_total'
                 AND p.post_type = 'shop_order'
                 AND p.post_status IN ('wc-completed','wc-processing')
                 AND p.post_date >= %s", $since
            ));

            // Order count
            $order_count = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->posts}
                 WHERE post_type = 'shop_order'
                 AND post_status IN ('wc-completed','wc-processing')
                 AND post_date >= %s", $since
            ));

            // Product count
            $product_count = $wpdb->get_var(
                "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'product' AND post_status = 'publish'"
            );

            // Top products by sales
            $top_products = $wpdb->get_results($wpdb->prepare(
                "SELECT pm.meta_value as product_id, p2.post_title as name,
                        SUM(oim.meta_value) as quantity, COUNT(DISTINCT oi.order_id) as orders
                 FROM {$wpdb->prefix}woocommerce_order_items oi
                 JOIN {$wpdb->prefix}woocommerce_order_itemmeta oim ON oim.order_item_id = oi.order_item_id AND oim.meta_key = '_qty'
                 JOIN {$wpdb->prefix}woocommerce_order_itemmeta pm ON pm.order_item_id = oi.order_item_id AND pm.meta_key = '_product_id'
                 JOIN {$wpdb->posts} p ON p.ID = oi.order_id AND p.post_status IN ('wc-completed','wc-processing') AND p.post_date >= %s
                 JOIN {$wpdb->posts} p2 ON p2.ID = pm.meta_value
                 WHERE oi.order_item_type = 'line_item'
                 GROUP BY pm.meta_value ORDER BY quantity DESC LIMIT 10", $since
            ));

            // Orders by status
            $by_status = $wpdb->get_results(
                "SELECT post_status as status, COUNT(*) as count FROM {$wpdb->posts}
                 WHERE post_type = 'shop_order' GROUP BY post_status"
            );

            return new WP_REST_Response([
                'active' => true,
                'period_days' => $days,
                'revenue' => round((float)$revenue, 2),
                'order_count' => (int)$order_count,
                'product_count' => (int)$product_count,
                'avg_order_value' => $order_count > 0 ? round((float)$revenue / $order_count, 2) : 0,
                'top_products' => array_map(function ($p) {
                    return [
                        'id' => (int)$p->product_id,
                        'name' => $p->name,
                        'quantity' => (int)$p->quantity,
                        'orders' => (int)$p->orders,
                    ];
                }, $top_products ?: []),
                'by_status' => array_reduce($by_status ?: [], function ($carry, $s) {
                    $carry[str_replace('wc-', '', $s->status)] = (int)$s->count;
                    return $carry;
                }, []),
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Write: Update product ───
    register_rest_route('tinyeclipse/v1', '/products/(?P<id>\d+)', [
        'methods' => 'POST',
        'callback' => function ($request) {
            if (!class_exists('WooCommerce')) return new WP_REST_Response(['error' => 'WooCommerce not installed'], 400);
            $product = wc_get_product((int)$request['id']);
            if (!$product) return new WP_REST_Response(['error' => 'Product not found'], 404);

            $params = $request->get_json_params();
            if (isset($params['name'])) $product->set_name(sanitize_text_field($params['name']));
            if (isset($params['price'])) $product->set_regular_price(sanitize_text_field($params['price']));
            if (isset($params['sale_price'])) $product->set_sale_price(sanitize_text_field($params['sale_price']));
            if (isset($params['description'])) $product->set_description(wp_kses_post($params['description']));
            if (isset($params['short_description'])) $product->set_short_description(wp_kses_post($params['short_description']));
            if (isset($params['stock_status'])) $product->set_stock_status(sanitize_text_field($params['stock_status']));
            if (isset($params['stock_quantity'])) $product->set_stock_quantity((int)$params['stock_quantity']);
            if (isset($params['status'])) $product->set_status(sanitize_text_field($params['status']));

            $product->save();

            return new WP_REST_Response([
                'status' => 'updated', 'product_id' => $product->get_id(),
                'name' => $product->get_name(), 'price' => $product->get_price(),
                'url' => $product->get_permalink(),
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Write: Update order status ───
    register_rest_route('tinyeclipse/v1', '/orders/(?P<id>\d+)/status', [
        'methods' => 'POST',
        'callback' => function ($request) {
            if (!class_exists('WooCommerce')) return new WP_REST_Response(['error' => 'WooCommerce not installed'], 400);
            $order = wc_get_order((int)$request['id']);
            if (!$order) return new WP_REST_Response(['error' => 'Order not found'], 404);

            $params = $request->get_json_params();
            if (!empty($params['status'])) {
                $order->update_status(sanitize_text_field($params['status']), 'Status gewijzigd via Eclipse Hub');
            }
            if (!empty($params['note'])) {
                $order->add_order_note(sanitize_text_field($params['note']));
            }

            return new WP_REST_Response([
                'status' => 'updated', 'order_id' => $order->get_id(),
                'new_status' => $order->get_status(),
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Create product ───
    register_rest_route('tinyeclipse/v1', '/products/create', [
        'methods' => 'POST',
        'callback' => function ($request) {
            if (!class_exists('WooCommerce')) {
                return new WP_REST_Response(['error' => 'WooCommerce not active'], 400);
            }
            $data = $request->get_json_params();
            $product = new WC_Product_Simple();
            $product->set_name(sanitize_text_field($data['name'] ?? 'New Product'));
            if (isset($data['price']))         $product->set_regular_price($data['price']);
            if (isset($data['sale_price']))    $product->set_sale_price($data['sale_price']);
            if (isset($data['description']))   $product->set_description(wp_kses_post($data['description']));
            if (isset($data['stock_status']))  $product->set_stock_status($data['stock_status']);
            if (isset($data['stock_quantity'])) {
                $product->set_manage_stock(true);
                $product->set_stock_quantity((int) $data['stock_quantity']);
            }
            $product->set_status('publish');
            $id = $product->save();
            return new WP_REST_Response(['id' => $id, 'name' => $product->get_name(), 'success' => true], 201);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Delete product ───
    register_rest_route('tinyeclipse/v1', '/products/(?P<id>\d+)/delete', [
        'methods' => 'POST',
        'callback' => function ($request) {
            if (!class_exists('WooCommerce')) {
                return new WP_REST_Response(['error' => 'WooCommerce not active'], 400);
            }
            $product = wc_get_product($request['id']);
            if (!$product) return new WP_REST_Response(['error' => 'Product not found'], 404);
            $product->delete(true);
            return new WP_REST_Response(['deleted' => true, 'id' => (int) $request['id']], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Duplicate product ───
    register_rest_route('tinyeclipse/v1', '/products/(?P<id>\d+)/duplicate', [
        'methods' => 'POST',
        'callback' => function ($request) {
            if (!class_exists('WooCommerce')) {
                return new WP_REST_Response(['error' => 'WooCommerce not active'], 400);
            }
            $original = wc_get_product($request['id']);
            if (!$original) return new WP_REST_Response(['error' => 'Product not found'], 404);

            $duplicate = clone $original;
            $duplicate->set_id(0);
            $duplicate->set_name($original->get_name() . ' (kopie)');
            $duplicate->set_slug('');
            $duplicate->set_date_created(null);
            $duplicate->set_total_sales(0);
            $duplicate->set_status('draft');
            $new_id = $duplicate->save();

            return new WP_REST_Response([
                'id'      => $new_id,
                'name'    => $duplicate->get_name(),
                'success' => true,
            ], 201);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Add order note ───
    register_rest_route('tinyeclipse/v1', '/orders/(?P<id>\d+)/note', [
        'methods' => 'POST',
        'callback' => function ($request) {
            if (!class_exists('WooCommerce')) {
                return new WP_REST_Response(['error' => 'WooCommerce not active'], 400);
            }
            $order = wc_get_order($request['id']);
            if (!$order) return new WP_REST_Response(['error' => 'Order not found'], 404);
            $data = $request->get_json_params();
            $note = sanitize_text_field($data['note'] ?? '');
            if ($note) {
                $order->add_order_note($note, 0, false);
            }
            return new WP_REST_Response(['success' => true], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);

    // ─── Abandoned carts overview ───
    register_rest_route('tinyeclipse/v1', '/shop/abandoned-carts', [
        'methods' => 'GET',
        'callback' => function () {
            global $wpdb;
            $transients = $wpdb->get_results(
                "SELECT option_name, option_value FROM {$wpdb->options}
                 WHERE option_name LIKE '_transient_tinyeclipse_cart_%'
                 AND option_name NOT LIKE '_transient_timeout_%'"
            );

            $carts = [];
            foreach ($transients as $t) {
                $session_id = str_replace('_transient_tinyeclipse_cart_', '', $t->option_name);
                $cart_data = maybe_unserialize($t->option_value);
                if (!$cart_data) continue;

                $carts[] = [
                    'session_id' => $session_id,
                    'total' => $cart_data['total'] ?? 0,
                    'item_count' => $cart_data['item_count'] ?? 0,
                    'items' => $cart_data['items'] ?? [],
                    'updated_at' => $cart_data['updated_at'] ?? null,
                ];
            }

            return new WP_REST_Response([
                'active' => true,
                'total' => count($carts),
                'carts' => $carts,
            ], 200);
        },
        'permission_callback' => 'tinyeclipse_verify_request',
    ]);
});

// ═══════════════════════════════════════════════════════════════
// INTER-PLUGIN HOOKS — Register with core connector
// ═══════════════════════════════════════════════════════════════

// Health modules
add_filter('tinyeclipse_health_modules', function ($modules) {
    $modules['woocommerce'] = [
        'available' => class_exists('WooCommerce'),
        'version'   => defined('WC_VERSION') ? WC_VERSION : null,
        'status'    => class_exists('WooCommerce') ? 'healthy' : 'inactive',
        'plugin'    => 'tinyeclipse-wc',
        'plugin_version' => TINYECLIPSE_WC_VERSION,
    ];
    return $modules;
});

// Chat commands
add_filter('tinyeclipse_chat_commands', function ($commands) {
    $commands['orders'] = [
        'keywords' => ['order', 'bestelling', 'bestellingen', 'omzet', 'revenue'],
        'callback' => function ($msg) {
            if (!class_exists('WooCommerce')) return '❌ WooCommerce niet actief.';
            global $wpdb;
            $since = date('Y-m-d', strtotime('-30 days'));
            $revenue = $wpdb->get_var($wpdb->prepare(
                "SELECT SUM(meta_value) FROM {$wpdb->postmeta} pm JOIN {$wpdb->posts} p ON p.ID = pm.post_id WHERE pm.meta_key = '_order_total' AND p.post_type = 'shop_order' AND p.post_status IN ('wc-completed','wc-processing') AND p.post_date >= %s", $since
            ));
            $count = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'shop_order' AND post_status IN ('wc-completed','wc-processing') AND post_date >= %s", $since
            ));
            $products = wp_count_posts('product')->publish;
            return "🛒 <strong>Shop (30 dagen)</strong><br>"
                . "Omzet: <strong>€" . number_format((float)$revenue, 2, ',', '.') . "</strong><br>"
                . "Bestellingen: <strong>{$count}</strong><br>"
                . "Producten: {$products}<br>"
                . "Gem. bestelling: €" . ($count > 0 ? number_format((float)$revenue / $count, 2, ',', '.') : '0,00');
        },
    ];
    $commands['products'] = [
        'keywords' => ['product', 'producten', 'voorraad', 'stock', 'inventory'],
        'callback' => function ($msg) {
            if (!class_exists('WooCommerce')) return '❌ WooCommerce niet actief.';
            $total = wp_count_posts('product')->publish;
            global $wpdb;
            $out_of_stock = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = '_stock_status' AND meta_value = 'outofstock'");
            $on_sale = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = '_sale_price' AND meta_value != '' AND meta_value > 0");
            return "📦 <strong>Producten</strong><br>"
                . "Totaal: {$total} · Uitverkocht: {$out_of_stock} · In aanbieding: {$on_sale}";
        },
    ];
    $commands['abandoned'] = [
        'keywords' => ['abandoned', 'verlaten', 'winkelwagen', 'cart'],
        'callback' => function ($msg) {
            global $wpdb;
            $count = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE '_transient_tinyeclipse_cart_%' AND option_name NOT LIKE '_transient_timeout_%'");
            return "🛒 <strong>Verlaten Winkelwagens</strong><br>Actief: {$count} winkelwagen(s) worden getrackt.";
        },
    ];
    return $commands;
});

// Quick actions for chat bubble
add_filter('tinyeclipse_quick_actions', function ($actions, $is_shop) {
    if ($is_shop) {
        $actions[] = ['key' => 'orders', 'label' => '🛒 Orders', 'prompt' => 'orders'];
        $actions[] = ['key' => 'products', 'label' => '📦 Products', 'prompt' => 'products'];
    }
    return $actions;
}, 10, 2);

// Helicopter stats
add_filter('tinyeclipse_helicopter_stats', function ($stats) {
    if (!class_exists('WooCommerce')) return $stats;
    global $wpdb;
    $since = date('Y-m-d', strtotime('-30 days'));
    $revenue = $wpdb->get_var($wpdb->prepare(
        "SELECT SUM(meta_value) FROM {$wpdb->postmeta} pm JOIN {$wpdb->posts} p ON p.ID = pm.post_id WHERE pm.meta_key = '_order_total' AND p.post_type = 'shop_order' AND p.post_status IN ('wc-completed','wc-processing') AND p.post_date >= %s", $since
    ));
    $stats['revenue_30d'] = '€' . number_format((float)$revenue, 0, ',', '.');
    $stats['products'] = wp_count_posts('product')->publish;
    return $stats;
});

// Admin menu items — 3 separate pages: Producten, Bestellingen, Shop Stats
add_filter('tinyeclipse_admin_menu_items', function ($items) {
    $items[] = [
        'title' => 'Producten',
        'slug'  => 'tinyeclipse-products',
        'icon'  => '📦',
        'cap'   => 'manage_woocommerce',
        'callback' => function () {
            include TINYECLIPSE_WC_DIR . 'admin/views/products.php';
        },
    ];
    $items[] = [
        'title' => 'Bestellingen',
        'slug'  => 'tinyeclipse-orders',
        'icon'  => '🛒',
        'cap'   => 'manage_woocommerce',
        'callback' => function () {
            include TINYECLIPSE_WC_DIR . 'admin/views/orders.php';
        },
    ];
    $items[] = [
        'title' => 'Shop Stats',
        'slug'  => 'tinyeclipse-shop-stats',
        'icon'  => '�',
        'cap'   => 'manage_woocommerce',
        'callback' => function () {
            if (!class_exists('WooCommerce')) {
                echo '<div class="wrap"><h1>� Shop Stats</h1><p>WooCommerce is niet actief.</p></div>';
                return;
            }
            global $wpdb;
            $days = 30;
            $since = date('Y-m-d', strtotime("-{$days} days"));
            $revenue = (float)$wpdb->get_var($wpdb->prepare("SELECT SUM(meta_value) FROM {$wpdb->postmeta} pm JOIN {$wpdb->posts} p ON p.ID = pm.post_id WHERE pm.meta_key = '_order_total' AND p.post_type = 'shop_order' AND p.post_status IN ('wc-completed','wc-processing') AND p.post_date >= %s", $since));
            $orders = (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'shop_order' AND post_status IN ('wc-completed','wc-processing') AND post_date >= %s", $since));
            $products = wp_count_posts('product')->publish;
            $abandoned = (int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE '_transient_tinyeclipse_cart_%' AND option_name NOT LIKE '_transient_timeout_%'");
            ?>
            <div class="wrap" style="max-width:900px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                <h1 style="font-size:22px;margin-bottom:20px;">� Shop Intelligence</h1>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
                    <div style="background:linear-gradient(135deg,#6366f1,#9333ea);border-radius:12px;padding:16px;color:white;text-align:center;">
                        <div style="font-size:11px;opacity:0.8;text-transform:uppercase;">Omzet (<?php echo $days; ?>d)</div>
                        <div style="font-size:28px;font-weight:700;">€<?php echo number_format($revenue, 0, ',', '.'); ?></div>
                    </div>
                    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Bestellingen</div>
                        <div style="font-size:28px;font-weight:700;color:#111827;"><?php echo $orders; ?></div>
                    </div>
                    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Producten</div>
                        <div style="font-size:28px;font-weight:700;color:#111827;"><?php echo $products; ?></div>
                    </div>
                    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Verlaten Carts</div>
                        <div style="font-size:28px;font-weight:700;color:#eab308;"><?php echo $abandoned; ?></div>
                    </div>
                </div>
                <p style="color:#9ca3af;font-size:12px;">TinyEclipse WC v<?php echo TINYECLIPSE_WC_VERSION; ?> — Bekijk meer in <a href="<?php echo esc_url(defined('TINYECLIPSE_HUB_URL') ? TINYECLIPSE_HUB_URL : 'https://tinyeclipse.digitalfarmers.be'); ?>" target="_blank" style="color:#6366f1;">Eclipse Hub</a></p>
            </div>
            <?php
        },
    ];
    return $items;
});

// Client overview modules
add_filter('tinyeclipse_client_overview_modules', function ($modules) {
    if (!class_exists('WooCommerce')) return $modules;
    global $wpdb;
    $since = date('Y-m-d', strtotime('-30 days'));
    $revenue = (float)$wpdb->get_var($wpdb->prepare("SELECT SUM(meta_value) FROM {$wpdb->postmeta} pm JOIN {$wpdb->posts} p ON p.ID = pm.post_id WHERE pm.meta_key = '_order_total' AND p.post_type = 'shop_order' AND p.post_status IN ('wc-completed','wc-processing') AND p.post_date >= %s", $since));
    $orders = (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'shop_order' AND post_status IN ('wc-completed','wc-processing') AND post_date >= %s", $since));
    $modules['woocommerce'] = [
        'active' => true, 'revenue_30d' => $revenue, 'orders_30d' => $orders,
        'products' => wp_count_posts('product')->publish,
    ];
    return $modules;
});

// Token costs for WC actions
add_filter('tinyeclipse_token_costs', function ($costs) {
    $costs['wc_product_update'] = 2;
    $costs['wc_order_update'] = 2;
    $costs['wc_report'] = 3;
    return $costs;
});

// ─── Activation Hook ───
register_activation_hook(__FILE__, function () {
    if (!wp_next_scheduled('tinyeclipse_check_abandoned_carts')) {
        wp_schedule_event(time(), 'tinyeclipse_30min', 'tinyeclipse_check_abandoned_carts');
    }
});

// ─── Deactivation Hook ───
register_deactivation_hook(__FILE__, function () {
    wp_clear_scheduled_hook('tinyeclipse_check_abandoned_carts');
});
