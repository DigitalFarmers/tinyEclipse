<?php
if (!defined('ABSPATH')) exit;
if (!class_exists('WooCommerce')) {
    echo '<div class="wrap"><h1>🛒 Bestellingen</h1><p>WooCommerce is niet actief.</p></div>';
    return;
}

global $wpdb;

// Filters
$status_filter = sanitize_text_field($_GET['status'] ?? '');
$search = sanitize_text_field($_GET['s'] ?? '');
$paged = max(1, (int)($_GET['paged'] ?? 1));
$per_page = 20;

$args = [
    'limit' => $per_page,
    'page' => $paged,
    'orderby' => 'date',
    'order' => 'DESC',
];

if ($status_filter) {
    $args['status'] = $status_filter;
}
if ($search) {
    // Search by order number, customer name, or email
    $args['s'] = $search;
}

$orders = wc_get_orders($args);

// Count by status
$status_counts = [];
$statuses = wc_get_order_statuses();
foreach ($statuses as $slug => $label) {
    $count = (int)$wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'shop_order' AND post_status = %s",
        $slug
    ));
    if ($count > 0) {
        $status_counts[$slug] = ['label' => $label, 'count' => $count];
    }
}

$total_orders = array_sum(array_column($status_counts, 'count'));
$total_pages = ceil($total_orders / $per_page);

// Revenue stats
$days = 30;
$since = date('Y-m-d', strtotime("-{$days} days"));
$revenue_30d = (float)$wpdb->get_var($wpdb->prepare(
    "SELECT COALESCE(SUM(meta_value),0) FROM {$wpdb->postmeta} pm 
     JOIN {$wpdb->posts} p ON p.ID = pm.post_id 
     WHERE pm.meta_key = '_order_total' AND p.post_type = 'shop_order' 
     AND p.post_status IN ('wc-completed','wc-processing') AND p.post_date >= %s", $since
));
$orders_30d = (int)$wpdb->get_var($wpdb->prepare(
    "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'shop_order' 
     AND post_status IN ('wc-completed','wc-processing') AND post_date >= %s", $since
));
$avg_order = $orders_30d > 0 ? $revenue_30d / $orders_30d : 0;
?>
<style>
.te-orders{max-width:1200px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.te-orders table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb}
.te-orders th{background:#f9fafb;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;text-align:left;border-bottom:1px solid #e5e7eb}
.te-orders td{padding:10px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;color:#374151}
.te-orders tr:hover td{background:#faf5ff}
.te-status-badge{padding:3px 10px;border-radius:10px;font-size:10px;font-weight:600;display:inline-block}
.te-stat-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center}
.te-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px}
.te-toolbar input,.te-toolbar select{padding:6px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px}
.te-pagination{display:flex;gap:4px;align-items:center;margin-top:16px;font-size:12px}
.te-pagination a,.te-pagination span{padding:4px 10px;border:1px solid #e5e7eb;border-radius:6px;text-decoration:none;color:#374151}
.te-pagination a:hover{background:#f3f4f6;border-color:#6366f1}
.te-pagination .current{background:#6366f1;color:#fff;border-color:#6366f1}
.te-status-tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px}
.te-status-tab{padding:4px 12px;border-radius:6px;font-size:11px;text-decoration:none;color:#6b7280;border:1px solid #e5e7eb;background:#fff}
.te-status-tab:hover{background:#f9fafb;border-color:#6366f1;color:#6366f1}
.te-status-tab.active{background:#6366f1;color:#fff;border-color:#6366f1}
</style>

<div class="wrap te-orders">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
            <h1 style="margin:0;font-size:22px;font-weight:700;">🛒 Bestellingen</h1>
            <p style="margin:4px 0 0;color:#6b7280;font-size:13px;"><?php echo $total_orders; ?> bestellingen totaal</p>
        </div>
    </div>

    <!-- Revenue Stats -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
        <div style="background:linear-gradient(135deg,#6366f1,#9333ea);border-radius:12px;padding:16px;color:white;text-align:center;">
            <div style="font-size:11px;opacity:0.8;text-transform:uppercase;">Omzet (<?php echo $days; ?>d)</div>
            <div style="font-size:28px;font-weight:700;">€<?php echo number_format($revenue_30d, 0, ',', '.'); ?></div>
        </div>
        <div class="te-stat-card">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Bestellingen (<?php echo $days; ?>d)</div>
            <div style="font-size:28px;font-weight:700;color:#111827;"><?php echo $orders_30d; ?></div>
        </div>
        <div class="te-stat-card">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Gem. Bestelling</div>
            <div style="font-size:28px;font-weight:700;color:#111827;">€<?php echo number_format($avg_order, 2, ',', '.'); ?></div>
        </div>
    </div>

    <!-- Status Tabs -->
    <div class="te-status-tabs">
        <a href="<?php echo admin_url('admin.php?page=tinyeclipse-orders'); ?>" class="te-status-tab <?php echo empty($status_filter) ? 'active' : ''; ?>">
            Alle (<?php echo $total_orders; ?>)
        </a>
        <?php foreach ($status_counts as $slug => $info): 
            $colors = [
                'wc-pending' => '#eab308', 'wc-processing' => '#3b82f6', 'wc-on-hold' => '#f97316',
                'wc-completed' => '#22c55e', 'wc-cancelled' => '#ef4444', 'wc-refunded' => '#9ca3af',
                'wc-failed' => '#ef4444',
            ];
            $color = $colors[$slug] ?? '#6b7280';
        ?>
        <a href="<?php echo admin_url('admin.php?page=tinyeclipse-orders&status=' . urlencode(str_replace('wc-', '', $slug))); ?>" 
           class="te-status-tab <?php echo $status_filter === str_replace('wc-', '', $slug) ? 'active' : ''; ?>"
           style="<?php echo $status_filter === str_replace('wc-', '', $slug) ? '' : 'border-left:3px solid '.$color.';'; ?>">
            <?php echo esc_html($info['label']); ?> (<?php echo $info['count']; ?>)
        </a>
        <?php endforeach; ?>
    </div>

    <!-- Search -->
    <form class="te-toolbar" method="get" action="<?php echo admin_url('admin.php'); ?>">
        <input type="hidden" name="page" value="tinyeclipse-orders">
        <?php if ($status_filter): ?><input type="hidden" name="status" value="<?php echo esc_attr($status_filter); ?>"><?php endif; ?>
        <input type="search" name="s" value="<?php echo esc_attr($search); ?>" placeholder="Zoek op klant, e-mail of bestelnr..." style="min-width:250px;">
        <button type="submit" style="padding:6px 12px;border:1px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer;font-size:12px;">🔍 Zoeken</button>
    </form>

    <!-- Orders Table -->
    <table>
        <thead>
            <tr>
                <th>Bestelling</th>
                <th>Klant</th>
                <th>Status</th>
                <th>Totaal</th>
                <th>Artikelen</th>
                <th>Datum</th>
                <th style="width:60px;">Actie</th>
            </tr>
        </thead>
        <tbody>
            <?php if (empty($orders)): ?>
            <tr><td colspan="7" style="text-align:center;padding:40px;color:#9ca3af;">Geen bestellingen gevonden.</td></tr>
            <?php endif; ?>
            <?php foreach ($orders as $order):
                $oid = $order->get_id();
                $status = $order->get_status();
                $customer_name = trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name());
                $customer_email = $order->get_billing_email();
                $item_count = $order->get_item_count();
                $date = $order->get_date_created();
                
                // Status colors
                $status_colors = [
                    'pending' => ['#fefce8', '#eab308'], 'processing' => ['#eff6ff', '#3b82f6'],
                    'on-hold' => ['#fff7ed', '#f97316'], 'completed' => ['#f0fdf4', '#22c55e'],
                    'cancelled' => ['#fef2f2', '#ef4444'], 'refunded' => ['#f9fafb', '#9ca3af'],
                    'failed' => ['#fef2f2', '#ef4444'],
                ];
                $sc = $status_colors[$status] ?? ['#f9fafb', '#6b7280'];
                $status_label = wc_get_order_status_name($status);
            ?>
            <tr>
                <td>
                    <a href="<?php echo admin_url('post.php?post=' . $oid . '&action=edit'); ?>" style="color:#6366f1;font-weight:600;text-decoration:none;">
                        #<?php echo $order->get_order_number(); ?>
                    </a>
                </td>
                <td>
                    <div style="font-weight:500;"><?php echo esc_html($customer_name ?: 'Gast'); ?></div>
                    <?php if ($customer_email): ?>
                    <div style="font-size:11px;color:#9ca3af;"><?php echo esc_html($customer_email); ?></div>
                    <?php endif; ?>
                </td>
                <td>
                    <span class="te-status-badge" style="background:<?php echo $sc[0]; ?>;color:<?php echo $sc[1]; ?>;">
                        <?php echo esc_html($status_label); ?>
                    </span>
                </td>
                <td style="font-weight:600;">€<?php echo number_format((float)$order->get_total(), 2, ',', '.'); ?></td>
                <td style="color:#6b7280;"><?php echo $item_count; ?> item<?php echo $item_count !== 1 ? 's' : ''; ?></td>
                <td style="font-size:12px;color:#6b7280;">
                    <?php echo $date ? $date->date_i18n('d M Y H:i') : '—'; ?>
                </td>
                <td>
                    <a href="<?php echo admin_url('post.php?post=' . $oid . '&action=edit'); ?>" style="color:#6366f1;text-decoration:none;font-size:12px;">Bekijk</a>
                </td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>

    <!-- Pagination -->
    <?php if ($total_pages > 1): ?>
    <div class="te-pagination">
        <?php for ($i = 1; $i <= min($total_pages, 20); $i++): 
            $url = add_query_arg(['page' => 'tinyeclipse-orders', 'paged' => $i, 'status' => $status_filter, 's' => $search], admin_url('admin.php'));
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
