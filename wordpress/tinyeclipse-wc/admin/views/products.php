<?php
if (!defined('ABSPATH')) exit;
if (!class_exists('WooCommerce')) {
    echo '<div class="wrap"><h1>📦 Producten</h1><p>WooCommerce is niet actief.</p></div>';
    return;
}

global $wpdb;

// WPML-aware product counting
$wpml_active = function_exists('icl_get_languages') && defined('ICL_SITEPRESS_VERSION');
$default_lang = null;
$lang_count = 1;
if ($wpml_active && function_exists('tinyeclipse_get_wpml_info')) {
    $wpml_info = tinyeclipse_get_wpml_info();
    $default_lang = $wpml_info['default_language'] ?? null;
    $lang_count = $wpml_info['language_count'] ?? 1;
}

// Get products — only main language if WPML active
$search = sanitize_text_field($_GET['s'] ?? '');
$paged = max(1, (int)($_GET['paged'] ?? 1));
$per_page = 20;
$stock_filter = sanitize_text_field($_GET['stock'] ?? '');
$cat_filter = sanitize_text_field($_GET['cat'] ?? '');

$args = [
    'limit' => $per_page,
    'page' => $paged,
    'orderby' => 'date',
    'order' => 'DESC',
    'status' => 'publish',
];

if ($search) {
    $args['s'] = $search;
}
if ($stock_filter === 'instock') {
    $args['stock_status'] = 'instock';
} elseif ($stock_filter === 'outofstock') {
    $args['stock_status'] = 'outofstock';
} elseif ($stock_filter === 'low') {
    $args['stock_status'] = 'instock';
}
if ($cat_filter) {
    $args['category'] = [$cat_filter];
}

// If WPML active, suppress language filter to get main language only
if ($wpml_active && $default_lang) {
    do_action('wpml_switch_language', $default_lang);
}

$products = wc_get_products($args);
$total_products_obj = wp_count_posts('product');
$total_all = $total_products_obj->publish;

if ($wpml_active && $default_lang && function_exists('tinyeclipse_count_main_language_posts')) {
    $total_main = tinyeclipse_count_main_language_posts('product', $default_lang);
} else {
    $total_main = $total_all;
}

$total_pages = ceil($total_main / $per_page);

// Get categories for filter
$categories = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => true]);

// Restore language
if ($wpml_active && $default_lang) {
    do_action('wpml_switch_language', null);
}
?>
<style>
.te-products{max-width:1200px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.te-products table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb}
.te-products th{background:#f9fafb;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;text-align:left;border-bottom:1px solid #e5e7eb}
.te-products td{padding:10px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;color:#374151}
.te-products tr:hover td{background:#faf5ff}
.te-products .te-thumb{width:40px;height:40px;border-radius:6px;object-fit:cover;background:#f3f4f6}
.te-stock-badge{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
.te-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px}
.te-toolbar input,.te-toolbar select{padding:6px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px}
.te-pagination{display:flex;gap:4px;align-items:center;margin-top:16px;font-size:12px}
.te-pagination a,.te-pagination span{padding:4px 10px;border:1px solid #e5e7eb;border-radius:6px;text-decoration:none;color:#374151}
.te-pagination a:hover{background:#f3f4f6;border-color:#6366f1}
.te-pagination .current{background:#6366f1;color:#fff;border-color:#6366f1}
</style>

<div class="wrap te-products">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
            <h1 style="margin:0;font-size:22px;font-weight:700;">📦 Producten</h1>
            <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">
                <?php if ($wpml_active): ?>
                    <?php echo $total_main; ?> unieke producten × <?php echo $lang_count; ?> talen
                    <span style="color:#9ca3af;">(<?php echo $total_all; ?> totaal in WP)</span>
                <?php else: ?>
                    <?php echo $total_main; ?> producten
                <?php endif; ?>
            </p>
        </div>
        <a href="<?php echo admin_url('post-new.php?post_type=product'); ?>" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-size:13px;font-weight:500;">
            + Nieuw product
        </a>
    </div>

    <!-- Toolbar -->
    <form class="te-toolbar" method="get" action="<?php echo admin_url('admin.php'); ?>">
        <input type="hidden" name="page" value="tinyeclipse-products">
        <input type="search" name="s" value="<?php echo esc_attr($search); ?>" placeholder="Zoek producten..." style="min-width:200px;">
        <select name="stock" onchange="this.form.submit()">
            <option value="">Alle voorraad</option>
            <option value="instock" <?php selected($stock_filter, 'instock'); ?>>Op voorraad</option>
            <option value="outofstock" <?php selected($stock_filter, 'outofstock'); ?>>Uitverkocht</option>
            <option value="low" <?php selected($stock_filter, 'low'); ?>>Laag</option>
        </select>
        <?php if (!empty($categories) && !is_wp_error($categories)): ?>
        <select name="cat" onchange="this.form.submit()">
            <option value="">Alle categorieën</option>
            <?php foreach ($categories as $cat): ?>
            <option value="<?php echo esc_attr($cat->slug); ?>" <?php selected($cat_filter, $cat->slug); ?>><?php echo esc_html($cat->name); ?> (<?php echo $cat->count; ?>)</option>
            <?php endforeach; ?>
        </select>
        <?php endif; ?>
        <button type="submit" style="padding:6px 12px;border:1px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer;font-size:12px;">🔍 Zoeken</button>
    </form>

    <!-- Products Table -->
    <table>
        <thead>
            <tr>
                <th style="width:50px;"></th>
                <th>Product</th>
                <th>SKU</th>
                <th>Prijs</th>
                <th>Voorraad</th>
                <th>Categorie</th>
                <?php if ($wpml_active): ?>
                <th>Vertalingen</th>
                <?php endif; ?>
                <th style="width:80px;">Acties</th>
            </tr>
        </thead>
        <tbody>
            <?php if (empty($products)): ?>
            <tr><td colspan="<?php echo $wpml_active ? 8 : 7; ?>" style="text-align:center;padding:40px;color:#9ca3af;">Geen producten gevonden.</td></tr>
            <?php endif; ?>
            <?php foreach ($products as $product):
                $pid = $product->get_id();
                $thumb = wp_get_attachment_image_url($product->get_image_id(), 'thumbnail') ?: '';
                $stock_status = $product->get_stock_status();
                $stock_qty = $product->get_stock_quantity();
                $sku = $product->get_sku();
                $cats = wc_get_product_category_list($pid, ', ');
                
                // Stock badge
                if ($stock_status === 'instock') {
                    $badge_color = '#22c55e'; $badge_bg = '#f0fdf4'; $badge_text = $stock_qty !== null ? $stock_qty . ' op voorraad' : 'Op voorraad';
                } elseif ($stock_status === 'onbackorder') {
                    $badge_color = '#eab308'; $badge_bg = '#fefce8'; $badge_text = 'Backorder';
                } else {
                    $badge_color = '#ef4444'; $badge_bg = '#fef2f2'; $badge_text = 'Uitverkocht';
                }
                
                // Low stock warning
                if ($stock_qty !== null && $stock_qty > 0 && $stock_qty <= 5) {
                    $badge_color = '#eab308'; $badge_bg = '#fefce8'; $badge_text = $stock_qty . ' — Laag!';
                }
                
                // WPML translations
                $translations = [];
                if ($wpml_active) {
                    $trid = apply_filters('wpml_element_trid', null, $pid, 'post_product');
                    if ($trid) {
                        $all_translations = apply_filters('wpml_get_element_translations', null, $trid, 'post_product');
                        if (is_array($all_translations)) {
                            foreach ($all_translations as $t) {
                                if (isset($t->language_code) && $t->language_code !== $default_lang) {
                                    $translations[$t->language_code] = !empty($t->element_id);
                                }
                            }
                        }
                    }
                }
            ?>
            <tr>
                <td>
                    <?php if ($thumb): ?>
                    <img src="<?php echo esc_url($thumb); ?>" class="te-thumb" alt="">
                    <?php else: ?>
                    <div class="te-thumb" style="display:flex;align-items:center;justify-content:center;font-size:16px;">📦</div>
                    <?php endif; ?>
                </td>
                <td>
                    <a href="<?php echo get_edit_post_link($pid); ?>" style="color:#111827;font-weight:500;text-decoration:none;"><?php echo esc_html($product->get_name()); ?></a>
                    <?php if ($product->get_type() === 'variable'): ?>
                    <span style="font-size:10px;color:#6b7280;margin-left:4px;">variabel</span>
                    <?php endif; ?>
                </td>
                <td style="color:#6b7280;font-size:12px;"><?php echo esc_html($sku ?: '—'); ?></td>
                <td style="font-weight:600;"><?php echo $product->get_price_html(); ?></td>
                <td>
                    <span class="te-stock-badge" style="background:<?php echo $badge_bg; ?>;color:<?php echo $badge_color; ?>;">
                        <?php echo esc_html($badge_text); ?>
                    </span>
                </td>
                <td style="font-size:12px;color:#6b7280;"><?php echo wp_strip_all_tags($cats ?: '—'); ?></td>
                <?php if ($wpml_active): ?>
                <td>
                    <?php foreach ($translations as $lc => $exists): ?>
                    <span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;margin-right:2px;<?php echo $exists ? 'background:#f0fdf4;color:#22c55e;' : 'background:#fef2f2;color:#ef4444;'; ?>">
                        <?php echo strtoupper($lc); ?>
                    </span>
                    <?php endforeach; ?>
                </td>
                <?php endif; ?>
                <td>
                    <a href="<?php echo get_edit_post_link($pid); ?>" style="color:#6366f1;text-decoration:none;font-size:12px;">Bewerk</a>
                    <span style="color:#e5e7eb;margin:0 2px;">|</span>
                    <a href="<?php echo get_permalink($pid); ?>" target="_blank" style="color:#6b7280;text-decoration:none;font-size:12px;">Bekijk</a>
                </td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>

    <!-- Pagination -->
    <?php if ($total_pages > 1): ?>
    <div class="te-pagination">
        <?php for ($i = 1; $i <= $total_pages; $i++): 
            $url = add_query_arg(['page' => 'tinyeclipse-products', 'paged' => $i, 's' => $search, 'stock' => $stock_filter, 'cat' => $cat_filter], admin_url('admin.php'));
        ?>
            <?php if ($i === $paged): ?>
                <span class="current"><?php echo $i; ?></span>
            <?php else: ?>
                <a href="<?php echo esc_url($url); ?>"><?php echo $i; ?></a>
            <?php endif; ?>
        <?php endfor; ?>
        <span style="color:#9ca3af;margin-left:8px;">Pagina <?php echo $paged; ?> van <?php echo $total_pages; ?></span>
    </div>
    <?php endif; ?>
</div>
