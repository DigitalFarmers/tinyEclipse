<?php
if (!defined('ABSPATH')) exit;
$audit = TinyEclipse_Security::instance()->audit();
$icon = $audit['score'] >= 80 ? '🟢' : ($audit['score'] >= 50 ? '🟡' : '🔴');
$color = $audit['score'] >= 80 ? '#22c55e' : ($audit['score'] >= 50 ? '#eab308' : '#ef4444');
?>
<div class="wrap" style="max-width:900px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <h1 style="font-size:22px;margin-bottom:20px;">🔒 Security Audit</h1>

    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:20px;text-align:center;">
        <div style="font-size:48px;font-weight:700;color:<?php echo $color; ?>;"><?php echo $audit['score']; ?>%</div>
        <div style="color:#6b7280;font-size:14px;"><?php echo $icon; ?> <?php echo $audit['passed']; ?>/<?php echo $audit['total']; ?> checks passed</div>
        <div style="color:#9ca3af;font-size:12px;margin-top:4px;">Gescand: <?php echo esc_html($audit['scanned_at']); ?></div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;">
        <?php foreach ($audit['checks'] as $key => $check):
            $s_icon = $check['status'] === 'pass' ? '✅' : ($check['status'] === 'warn' ? '⚠️' : '❌');
            $s_bg = $check['status'] === 'pass' ? '#f0fdf4' : ($check['status'] === 'warn' ? '#fefce8' : '#fef2f2');
            $s_border = $check['status'] === 'pass' ? '#bbf7d0' : ($check['status'] === 'warn' ? '#fef08a' : '#fecaca');
        ?>
        <div style="background:<?php echo $s_bg; ?>;border:1px solid <?php echo $s_border; ?>;border-radius:10px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;">
            <div>
                <div style="font-size:14px;font-weight:600;color:#111827;"><?php echo $s_icon; ?> <?php echo esc_html($check['label']); ?></div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;"><?php echo esc_html($check['detail']); ?></div>
            </div>
            <?php if (!empty($check['fix'])): ?>
            <div style="font-size:11px;color:#6366f1;max-width:250px;text-align:right;"><?php echo esc_html($check['fix']); ?></div>
            <?php endif; ?>
        </div>
        <?php endforeach; ?>
    </div>

    <div style="margin-top:20px;display:flex;gap:10px;">
        <button onclick="teSecurityFix('disable_xmlrpc')" class="button">🛡️ Disable XML-RPC</button>
        <button onclick="teSecurityFix('add_security_headers')" class="button">🔒 Add Security Headers</button>
        <button onclick="teAction('scan')" class="button button-primary">🔍 Opnieuw scannen</button>
    </div>
</div>
<script>
function teSecurityFix(type) {
    if (!confirm('Weet je zeker dat je deze fix wilt toepassen?')) return;
    jQuery.post(tinyeclipse.ajax_url, {action:'tinyeclipse_security_fix',nonce:tinyeclipse.nonce,fix_type:type}, function(r) {
        alert(r.success ? '✅ Fix toegepast!' : '❌ ' + (r.data||'Fout'));
        if (r.success) location.reload();
    });
}
function teAction(t) { jQuery.post(tinyeclipse.ajax_url, {action:'tinyeclipse_run_action',nonce:tinyeclipse.nonce,action_type:t}, function(r) { location.reload(); }); }
</script>
