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
            
            <?php if ($key === 'from_email' && !empty($check['from_name'])): ?>
            <div style="font-size:11px;color:#374151;margin-top:4px;">📧 From Name: <?php echo esc_html($check['from_name']); ?></div>
            <?php endif; ?>
            
            <?php if ($key === 'from_email' && !empty($check['is_smtp_configured'])): ?>
            <div style="font-size:11px;color:#22c55e;margin-top:4px;">✅ Geconfigureerd via <?php echo esc_html($audit['smtp_plugin']); ?></div>
            <?php endif; ?>
            
            <?php if (!empty($check['fix'])): ?>
            <div style="font-size:11px;color:#6366f1;margin-top:4px;">💡 <?php echo esc_html($check['fix']); ?></div>
            <?php endif; ?>
            
            <?php if (!empty($check['connections'])): ?>
            <div style="margin-top:8px;">
                <?php foreach ($check['connections'] as $conn): ?>
                <div style="font-size:11px;color:#374151;background:white;border-radius:6px;padding:6px 10px;margin-top:4px;display:flex;align-items:center;justify-content:space-between;">
                    <div>
                        <div style="font-weight:500;"><?php echo esc_html($conn['provider'] ?? 'unknown'); ?></div>
                        <div style="color:#6b7280;"><?php echo esc_html($conn['from_email'] ?? ''); ?></div>
                    </div>
                    <?php if (!empty($conn['from_email'])): ?>
                    <a href="mailto:<?php echo esc_attr($conn['from_email']); ?>" style="color:#6366f1;text-decoration:none;font-size:10px;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">Test Email</a>
                    <?php endif; ?>
                </div>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </div>
        <?php endforeach; ?>
    </div>
    
    <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
        <?php if ($audit['smtp_active']): ?>
        <button onclick="teTestEmail()" class="button">📧 Test Email</button>
        <button onclick="window.open('<?php echo admin_url('admin.php?page=fluentmail'); ?>', '_blank')" class="button">⚙️ FluentSMTP Settings</button>
        <?php else: ?>
        <button onclick="window.open('<?php echo admin_url('plugin-install.php?s=fluentsmtp&tab=search&type=term'); ?>', '_blank')" class="button button-primary">🚀 Install FluentSMTP</button>
        <?php endif; ?>
        <button onclick="teAction('scan')" class="button">🔍 Opnieuw scannen</button>
    </div>
</div>
<script>
function teTestEmail() {
    if (!confirm('Test email sturen naar <?php echo esc_js(get_option('admin_email')); ?>?')) return;
    jQuery.post(tinyeclipse.ajax_url, {action:'tinyeclipse_test_email',nonce:tinyeclipse.nonce}, function(r) {
        alert(r.success ? '✅ Test email verzonden!' : '❌ ' + (r.data||'Fout'));
    });
}
function teAction(t) { jQuery.post(tinyeclipse.ajax_url, {action:'tinyeclipse_run_action',nonce:tinyeclipse.nonce,action_type:t}, function(r) { location.reload(); }); }
</script>
