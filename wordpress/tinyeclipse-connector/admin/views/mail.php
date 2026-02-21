<?php
if (!defined('ABSPATH')) exit;
$audit = TinyEclipse_Mail::instance()->audit();
$icon = $audit['score'] >= 80 ? '🟢' : ($audit['score'] >= 50 ? '🟡' : '🔴');
$color = $audit['score'] >= 80 ? '#22c55e' : ($audit['score'] >= 50 ? '#eab308' : '#ef4444');
?>
<div class="wrap" style="max-width:900px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <h1 style="font-size:22px;margin-bottom:20px;">📧 Mail / SMTP Audit</h1>

    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:20px;text-align:center;">
        <div style="font-size:48px;font-weight:700;color:<?php echo $color; ?>;"><?php echo $audit['score']; ?>%</div>
        <div style="color:#6b7280;font-size:14px;"><?php echo $icon; ?> Mail configuratie</div>
        <?php if ($audit['smtp_plugin']): ?>
        <div style="color:#6366f1;font-size:12px;margin-top:4px;">SMTP: <?php echo esc_html($audit['smtp_plugin']); ?></div>
        <?php endif; ?>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;">
        <?php foreach ($audit['checks'] as $key => $check):
            $s = $check['status'] === 'pass' ? '✅' : ($check['status'] === 'warn' ? '⚠️' : ($check['status'] === 'info' ? 'ℹ️' : '❌'));
            $bg = $check['status'] === 'pass' ? '#f0fdf4' : ($check['status'] === 'warn' ? '#fefce8' : ($check['status'] === 'info' ? '#eff6ff' : '#fef2f2'));
            $bd = $check['status'] === 'pass' ? '#bbf7d0' : ($check['status'] === 'warn' ? '#fef08a' : ($check['status'] === 'info' ? '#bfdbfe' : '#fecaca'));
        ?>
        <div style="background:<?php echo $bg; ?>;border:1px solid <?php echo $bd; ?>;border-radius:10px;padding:14px 18px;">
            <div style="font-size:14px;font-weight:600;color:#111827;"><?php echo $s; ?> <?php echo esc_html($check['label']); ?></div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;"><?php echo esc_html($check['detail']); ?></div>
            <?php if (!empty($check['fix'])): ?>
            <div style="font-size:11px;color:#6366f1;margin-top:4px;">💡 <?php echo esc_html($check['fix']); ?></div>
            <?php endif; ?>
            <?php if (!empty($check['connections'])): ?>
            <div style="margin-top:8px;">
                <?php foreach ($check['connections'] as $conn): ?>
                <div style="font-size:11px;color:#374151;background:white;border-radius:6px;padding:6px 10px;margin-top:4px;">
                    <?php echo esc_html($conn['provider'] ?? 'unknown'); ?> — <?php echo esc_html($conn['from_email'] ?? ''); ?>
                </div>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </div>
        <?php endforeach; ?>
    </div>
</div>
