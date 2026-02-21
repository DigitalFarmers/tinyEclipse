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
            
            // Token costs for fixes
            $fix_costs = [
                'db_prefix' => 100,
                'wp_config_permissions' => 50,
                'plugin_updates' => 25
            ];
            $cost = $fix_costs[$key] ?? 0;
        ?>
        <div style="background:<?php echo $s_bg; ?>;border:1px solid <?php echo $s_border; ?>;border-radius:10px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;">
            <div style="flex:1;">
                <div style="font-size:14px;font-weight:600;color:#111827;"><?php echo $s_icon; ?> <?php echo esc_html($check['label']); ?></div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;"><?php echo esc_html($check['detail']); ?></div>
                
                <?php if ($check['status'] !== 'pass' && $cost > 0): ?>
                <div style="margin-top:4px;">
                    <span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:500;">🪙 <?php echo $cost; ?> tokens</span>
                    <span style="color:#6b7280;font-size:10px;margin-left:4px;">One-click fix</span>
                </div>
                <?php endif; ?>
            </div>
            
            <div style="display:flex;align-items:center;gap:8px;">
                <?php if (!empty($check['fix'])): ?>
                <div style="font-size:11px;color:#6366f1;max-width:200px;text-align:right;"><?php echo esc_html($check['fix']); ?></div>
                <?php endif; ?>
                
                <?php if ($check['status'] !== 'pass' && $cost > 0): ?>
                <button onclick="teSecurityFix('<?php echo $key; ?>', <?php echo $cost; ?>)" 
                        style="background:#6366f1;color:white;border:none;padding:6px 12px;border-radius:6px;font-size:11px;cursor:pointer;" 
                        onmouseover="this.style.background='#4f46e5'" onmouseout="this.style.background='#6366f1'">
                    Fix (<?php echo $cost; ?> 🪙)
                </button>
                <?php endif; ?>
            </div>
        </div>
        <?php endforeach; ?>
    </div>

    <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
        <button onclick="teAction('scan')" class="button button-primary">� Opnieuw scannen</button>
        <button onclick="window.open('<?php echo admin_url('admin.php?page=tinyeclipse-tokens'); ?>', '_blank')" class="button">🪙 Tokens Kopen</button>
        <button onclick="window.open('<?php echo admin_url('admin.php?page=tinyeclipse-logs'); ?>', '_blank')" class="button">� Rollback Log</button>
    </div>
</div>
<script>
function teSecurityFix(type, cost) {
    const message = `Security fix toepassen: ${type}\n\nKosten: ${cost} tokens\n\nDeze fix wordt automatisch toegepast met een rollback periode van 30 dagen.\n\nDoorgaan?`;
    if (!confirm(message)) return;
    
    // Show loading
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Bezig...';
    btn.disabled = true;
    
    jQuery.post(tinyeclipse.ajax_url, {
        action: 'tinyeclipse_security_fix',
        nonce: tinyeclipse.nonce,
        fix_type: type,
        auto_confirm: true
    }, function(r) {
        btn.innerHTML = originalText;
        btn.disabled = false;
        
        if (r.success) {
            alert('✅ ' + (r.data?.message || 'Fix toegepast!') + '\n\nRollback ID: ' + (r.data?.rollback_id || 'onbekend') + '\nVerloopt: ' + (r.data?.expires_at || 'onbekend'));
            location.reload();
        } else {
            alert('❌ ' + (r.data?.message || 'Fout bij toepassen van fix'));
            if (r.data?.required_tokens) {
                if (confirm('Onvoldoende tokens. Wil je tokens kopen?')) {
                    window.open('<?php echo admin_url('admin.php?page=tinyeclipse-tokens'); ?>', '_blank');
                }
            }
        }
    }).fail(function() {
        btn.innerHTML = originalText;
        btn.disabled = false;
        alert('❌ Verbinding fout. Probeer opnieuw.');
    });
}
function teAction(t) { jQuery.post(tinyeclipse.ajax_url, {action:'tinyeclipse_run_action',nonce:tinyeclipse.nonce,action_type:t}, function(r) { location.reload(); }); }
</script>
