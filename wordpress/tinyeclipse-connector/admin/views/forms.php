<?php
if (!defined('ABSPATH')) exit;
$audit = TinyEclipse_Forms::instance()->audit();
?>
<div class="wrap" style="max-width:900px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <h1 style="font-size:22px;margin-bottom:20px;">📋 Forms</h1>

    <?php if (!$audit['active']): ?>
    <div style="background:#fefce8;border:1px solid #fef08a;border-radius:12px;padding:20px;">
        <p style="margin:0;color:#713f12;">⚠️ Geen formulier plugin gevonden (FluentForms, CF7, of Gravity Forms).</p>
    </div>
    <?php else: ?>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Providers</div>
            <div style="font-size:14px;font-weight:600;color:#111827;margin-top:4px;"><?php echo esc_html(implode(', ', $audit['providers'])); ?></div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Formulieren</div>
            <div style="font-size:28px;font-weight:700;color:#111827;"><?php echo $audit['total_forms']; ?></div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Inzendingen</div>
            <div style="font-size:28px;font-weight:700;color:#6366f1;"><?php echo number_format($audit['total_submissions']); ?></div>
        </div>
    </div>

    <?php if (!empty($audit['forms'])): ?>
    <table class="widefat striped" style="border-radius:10px;overflow:hidden;">
        <thead><tr><th>Formulier</th><th>Provider</th><th>Status</th><th>Inzendingen</th><th>Laatste</th></tr></thead>
        <tbody>
        <?php foreach ($audit['forms'] as $form): ?>
        <tr>
            <td><strong><?php echo esc_html($form['title']); ?></strong></td>
            <td><?php echo esc_html($form['provider']); ?></td>
            <td><span style="color:<?php echo $form['status'] === 'active' || $form['status'] === 'published' ? '#22c55e' : '#9ca3af'; ?>;">● <?php echo esc_html($form['status']); ?></span></td>
            <td><?php echo number_format($form['submissions']); ?></td>
            <td><?php echo esc_html($form['last_submission'] ?? '-'); ?></td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>
    <?php endif; ?>
</div>
