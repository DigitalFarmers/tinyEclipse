<?php
if (!defined('ABSPATH')) exit;
global $wpdb;
$table = $wpdb->prefix . 'tinyeclipse_logs';
$logs = [];
if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
    $module_filter = sanitize_text_field($_GET['module'] ?? '');
    $level_filter = sanitize_text_field($_GET['level'] ?? '');
    $where = '1=1';
    if ($module_filter) $where .= $wpdb->prepare(" AND module = %s", $module_filter);
    if ($level_filter) $where .= $wpdb->prepare(" AND level = %s", $level_filter);
    $logs = $wpdb->get_results("SELECT * FROM {$table} WHERE {$where} ORDER BY id DESC LIMIT 200", ARRAY_A);
    $modules = $wpdb->get_col("SELECT DISTINCT module FROM {$table} ORDER BY module");
}
?>
<div class="wrap" style="max-width:1100px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <h1 style="font-size:22px;margin-bottom:20px;">📋 Logs</h1>

    <div style="display:flex;gap:10px;margin-bottom:16px;align-items:center;">
        <form method="get" style="display:flex;gap:8px;align-items:center;">
            <input type="hidden" name="page" value="tinyeclipse-logs" />
            <select name="module" style="padding:6px 10px;border-radius:6px;border:1px solid #d1d5db;">
                <option value="">Alle modules</option>
                <?php foreach ($modules ?? [] as $m): ?>
                <option value="<?php echo esc_attr($m); ?>" <?php selected($module_filter, $m); ?>><?php echo esc_html($m); ?></option>
                <?php endforeach; ?>
            </select>
            <select name="level" style="padding:6px 10px;border-radius:6px;border:1px solid #d1d5db;">
                <option value="">Alle levels</option>
                <option value="info" <?php selected($level_filter, 'info'); ?>>Info</option>
                <option value="warning" <?php selected($level_filter, 'warning'); ?>>Warning</option>
                <option value="error" <?php selected($level_filter, 'error'); ?>>Error</option>
            </select>
            <button type="submit" class="button">Filter</button>
        </form>
        <span style="color:#9ca3af;font-size:12px;"><?php echo count($logs); ?> logs</span>
    </div>

    <?php if (empty($logs)): ?>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:40px;text-align:center;color:#9ca3af;">
        Geen logs gevonden.
    </div>
    <?php else: ?>
    <table class="widefat striped" style="border-radius:10px;overflow:hidden;font-size:13px;">
        <thead><tr><th style="width:140px;">Datum</th><th style="width:80px;">Module</th><th style="width:60px;">Level</th><th>Bericht</th></tr></thead>
        <tbody>
        <?php foreach ($logs as $log):
            $level_color = $log['level'] === 'error' ? '#ef4444' : ($log['level'] === 'warning' ? '#eab308' : '#6b7280');
        ?>
        <tr>
            <td style="font-family:monospace;font-size:11px;color:#6b7280;"><?php echo esc_html($log['created_at']); ?></td>
            <td><span style="background:#f3f4f6;padding:2px 8px;border-radius:10px;font-size:11px;"><?php echo esc_html($log['module']); ?></span></td>
            <td><span style="color:<?php echo $level_color; ?>;font-weight:500;font-size:11px;"><?php echo esc_html(strtoupper($log['level'])); ?></span></td>
            <td><?php echo esc_html($log['message']); ?></td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>
</div>
