<?php
/**
 * TinyEclipse Sync Agent
 * Handles cross-site product/stock sync commands from Eclipse Hub.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_Sync_Agent {
    private static $instance = null;

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {
        // Hook into custom command handler
        add_filter('tinyeclipse_execute_custom_command', [$this, 'handle_command'], 10, 3);

        // Hook WooCommerce stock changes to propagate
        add_action('woocommerce_product_set_stock', [$this, 'on_stock_change'], 10, 1);
        add_action('woocommerce_variation_set_stock', [$this, 'on_stock_change'], 10, 1);
    }

    /**
     * Handle sync-related commands from the command queue.
     */
    public function handle_command($result, $command_type, $payload) {
        switch ($command_type) {
            case 'stock_update':
                return $this->execute_stock_update($payload);
            case 'product_sync':
                return $this->execute_product_sync($payload);
            case 'price_sync':
                return $this->execute_price_sync($payload);
        }
        return $result; // Not our command, pass through
    }

    /**
     * Apply a stock update from a sibling site.
     */
    private function execute_stock_update($payload) {
        $product_id = intval($payload['product_id'] ?? 0);
        $new_stock = intval($payload['new_stock'] ?? 0);
        $source_tenant = $payload['source_tenant_id'] ?? '';

        if (!$product_id) {
            return ['error' => 'Product ID required'];
        }

        $product = wc_get_product($product_id);
        if (!$product) {
            return ['error' => "Product #{$product_id} not found"];
        }

        $old_stock = $product->get_stock_quantity();

        // Temporarily remove our hook to prevent infinite loop
        remove_action('woocommerce_product_set_stock', [$this, 'on_stock_change'], 10);
        remove_action('woocommerce_variation_set_stock', [$this, 'on_stock_change'], 10);

        $product->set_stock_quantity($new_stock);
        $product->set_manage_stock(true);
        $product->save();

        // Re-add hooks
        add_action('woocommerce_product_set_stock', [$this, 'on_stock_change'], 10, 1);
        add_action('woocommerce_variation_set_stock', [$this, 'on_stock_change'], 10, 1);

        tinyeclipse_log('sync', 'info', "Stock synced for #{$product_id}: {$old_stock} → {$new_stock}", [
            'product_id' => $product_id,
            'old_stock' => $old_stock,
            'new_stock' => $new_stock,
            'source' => $source_tenant,
        ]);

        return [
            'success' => true,
            'product_id' => $product_id,
            'product_name' => $product->get_name(),
            'old_stock' => $old_stock,
            'new_stock' => $new_stock,
        ];
    }

    /**
     * Sync product data (title, description, price, images) from sibling.
     */
    private function execute_product_sync($payload) {
        $product_id = intval($payload['product_id'] ?? 0);
        $data = $payload['data'] ?? [];

        if (!$product_id || empty($data)) {
            return ['error' => 'Product ID and data required'];
        }

        $product = wc_get_product($product_id);
        if (!$product) {
            return ['error' => "Product #{$product_id} not found"];
        }

        $updated = [];

        if (isset($data['regular_price'])) {
            $product->set_regular_price($data['regular_price']);
            $updated[] = 'regular_price';
        }
        if (isset($data['sale_price'])) {
            $product->set_sale_price($data['sale_price']);
            $updated[] = 'sale_price';
        }
        if (isset($data['description'])) {
            $product->set_description($data['description']);
            $updated[] = 'description';
        }
        if (isset($data['short_description'])) {
            $product->set_short_description($data['short_description']);
            $updated[] = 'short_description';
        }
        if (isset($data['weight'])) {
            $product->set_weight($data['weight']);
            $updated[] = 'weight';
        }

        $product->save();

        tinyeclipse_log('sync', 'info', "Product synced for #{$product_id}", [
            'product_id' => $product_id,
            'fields_updated' => $updated,
        ]);

        return [
            'success' => true,
            'product_id' => $product_id,
            'fields_updated' => $updated,
        ];
    }

    /**
     * Sync only price from sibling.
     */
    private function execute_price_sync($payload) {
        $product_id = intval($payload['product_id'] ?? 0);
        $regular_price = $payload['regular_price'] ?? null;
        $sale_price = $payload['sale_price'] ?? null;

        if (!$product_id) {
            return ['error' => 'Product ID required'];
        }

        $product = wc_get_product($product_id);
        if (!$product) {
            return ['error' => "Product #{$product_id} not found"];
        }

        $changes = [];
        if ($regular_price !== null) {
            $old = $product->get_regular_price();
            $product->set_regular_price($regular_price);
            $changes['regular_price'] = ['from' => $old, 'to' => $regular_price];
        }
        if ($sale_price !== null) {
            $old = $product->get_sale_price();
            $product->set_sale_price($sale_price);
            $changes['sale_price'] = ['from' => $old, 'to' => $sale_price];
        }

        $product->save();

        return [
            'success' => true,
            'product_id' => $product_id,
            'changes' => $changes,
        ];
    }

    /**
     * When stock changes locally, notify Hub to propagate to siblings.
     */
    public function on_stock_change($product) {
        if (!function_exists('tinyeclipse_get_tenant_id') || !defined('TINYECLIPSE_API_BASE')) {
            return;
        }

        // Don't propagate in staging
        if (function_exists('tinyeclipse_is_staging') && tinyeclipse_is_staging()) {
            return;
        }

        $tenant_id = tinyeclipse_get_tenant_id();
        $product_id = $product->get_id();
        $new_stock = $product->get_stock_quantity();

        // Debounce: don't fire if same stock was already reported
        $cache_key = "tinyeclipse_stock_sync_{$product_id}";
        $last_reported = get_transient($cache_key);
        if ($last_reported !== false && intval($last_reported) === intval($new_stock)) {
            return;
        }
        set_transient($cache_key, $new_stock, 60);

        // Fire async to Hub
        wp_remote_post(TINYECLIPSE_API_BASE . '/api/admin/sync/stock-update', [
            'timeout' => 5,
            'blocking' => false,
            'headers' => [
                'Content-Type' => 'application/json',
                'X-Admin-Key' => get_option('tinyeclipse_hub_admin_key', ''),
            ],
            'body' => wp_json_encode([
                'tenant_id' => $tenant_id,
                'remote_id' => strval($product_id),
                'new_stock' => intval($new_stock),
            ]),
        ]);

        tinyeclipse_log('sync', 'info', "Stock change reported to Hub: #{$product_id} → {$new_stock}");
    }
}
