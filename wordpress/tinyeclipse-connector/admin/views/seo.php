<?php
if (!defined('ABSPATH')) exit;
$audit = TinyEclipse_SEO::instance()->audit();
$icon = $audit['score'] >= 80 ? '🟢' : ($audit['score'] >= 50 ? '🟡' : '🔴');
$color = $audit['score'] >= 80 ? '#22c55e' : ($audit['score'] >= 50 ? '#eab308' : '#ef4444');
?>
<div class="wrap" style="max-width:900px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <h1 style="font-size:22px;margin-bottom:20px;">🔍 SEO Audit</h1>

    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:20px;text-align:center;">
        <div style="font-size:48px;font-weight:700;color:<?php echo $color; ?>;"><?php echo $audit['score']; ?>%</div>
        <div style="color:#6b7280;font-size:14px;"><?php echo $icon; ?> <?php echo $audit['passed']; ?>/<?php echo $audit['total']; ?> checks passed</div>
        <?php if ($audit['seo_plugin']): ?>
        <div style="color:#6366f1;font-size:12px;margin-top:4px;">SEO Plugin: <?php echo esc_html($audit['seo_plugin']); ?></div>
        <?php endif; ?>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px;">
        <?php foreach ($audit['checks'] as $key => $check):
            if ($key === 'meta_descriptions') continue;
            $s = $check['status'] === 'pass' ? '✅' : ($check['status'] === 'warn' ? '⚠️' : '❌');
            $bg = $check['status'] === 'pass' ? '#f0fdf4' : ($check['status'] === 'warn' ? '#fefce8' : '#fef2f2');
            $bd = $check['status'] === 'pass' ? '#bbf7d0' : ($check['status'] === 'warn' ? '#fef08a' : '#fecaca');
        ?>
        <div style="background:<?php echo $bg; ?>;border:1px solid <?php echo $bd; ?>;border-radius:10px;padding:14px 18px;">
            <div style="font-size:14px;font-weight:600;color:#111827;"><?php echo $s; ?> <?php echo esc_html($check['label']); ?></div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;"><?php echo esc_html($check['detail']); ?></div>
        </div>
        <?php endforeach; ?>
    </div>

    <?php if (!empty($audit['checks']['meta_descriptions']['pages'])): ?>
    <h2 style="font-size:16px;margin-bottom:12px;">📄 Pagina SEO Status</h2>
    <table class="widefat striped" style="border-radius:10px;overflow:hidden;">
        <thead><tr><th>Pagina</th><th>Type</th><th>Titel</th><th>Meta</th><th>Woorden</th></tr></thead>
        <tbody>
        <?php foreach ($audit['checks']['meta_descriptions']['pages'] as $p): ?>
        <tr>
            <td><a href="<?php echo esc_url($p['url']); ?>" target="_blank"><?php echo esc_html($p['title']); ?></a></td>
            <td><?php echo esc_html($p['type']); ?></td>
            <td><?php echo $p['title_ok'] ? '✅' : '⚠️'; ?> <?php echo $p['title_length']; ?> chars</td>
            <td><?php echo $p['meta_ok'] ? '✅' : ($p['meta_length'] > 0 ? '⚠️' : '❌'); ?> <?php echo $p['meta_length']; ?> chars</td>
            <td><?php echo $p['content_ok'] ? '✅' : '⚠️'; ?> <?php echo number_format($p['word_count']); ?></td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>
</div>
