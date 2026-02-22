<?php
if (!defined('ABSPATH')) exit;
$audit = TinyEclipse_Security::instance()->audit();
$icon = $audit['score'] >= 80 ? '🟢' : ($audit['score'] >= 50 ? '🟡' : '🔴');
$color = $audit['score'] >= 80 ? '#22c55e' : ($audit['score'] >= 50 ? '#eab308' : '#ef4444');
$ring_pct = max(0, min(100, $audit['score']));

$fails = 0; $warns = 0; $passes = 0;
foreach ($audit['checks'] as $c) {
    if ($c['status'] === 'pass') $passes++;
    elseif ($c['status'] === 'warn') $warns++;
    else $fails++;
}

// Token costs for fixes
$fix_costs = [
    'db_prefix' => 100,
    'wp_config_permissions' => 50,
    'plugin_updates' => 25,
    'disable_xmlrpc' => 10,
    'add_security_headers' => 10,
];
?>
<div class="wrap" style="max-width:1200px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#9333ea);display:flex;align-items:center;justify-content:center;">
                <span style="font-size:22px;">🔒</span>
            </div>
            <div>
                <h1 style="margin:0;font-size:22px;font-weight:700;">Security Audit</h1>
                <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">Beveiligingscontrole met one-click fixes · Gescand: <?php echo esc_html($audit['scanned_at']); ?></p>
            </div>
        </div>
        <div style="display:flex;gap:8px;">
            <button onclick="location.reload()" class="button" style="border-radius:8px;">� Opnieuw scannen</button>
            <a href="<?php echo admin_url('admin.php?page=tinyeclipse-tokens'); ?>" class="button" style="border-radius:8px;">🪙 Tokens</a>
        </div>
    </div>

    <!-- Score + Stats -->
    <div style="display:grid;grid-template-columns:200px 1fr;gap:16px;margin-bottom:24px;">
        <!-- Score Circle -->
        <div style="background:white;border:1px solid #e5e7eb;border-radius:16px;padding:24px;text-align:center;">
            <div style="position:relative;width:120px;height:120px;margin:0 auto;">
                <svg viewBox="0 0 120 120" style="transform:rotate(-90deg);">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#f3f4f6" stroke-width="8"/>
                    <circle cx="60" cy="60" r="52" fill="none" stroke="<?php echo $color; ?>" stroke-width="8" stroke-linecap="round" stroke-dasharray="<?php echo 326.7 * $ring_pct / 100; ?> 326.7"/>
                </svg>
                <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                    <span style="font-size:32px;font-weight:800;color:<?php echo $color; ?>;"><?php echo $audit['score']; ?></span>
                    <span style="font-size:11px;color:#9ca3af;">/ 100</span>
                </div>
            </div>
            <div style="margin-top:8px;font-size:12px;color:#6b7280;"><?php echo $audit['passed']; ?>/<?php echo $audit['total']; ?> checks OK</div>
        </div>

        <!-- Stats Grid -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;">
                <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">✅ Passed</div>
                <div style="font-size:28px;font-weight:700;color:#22c55e;margin-top:2px;"><?php echo $passes; ?></div>
            </div>
            <div style="background:#fefce8;border:1px solid #fef08a;border-radius:10px;padding:14px;">
                <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">⚠️ Waarschuwingen</div>
                <div style="font-size:28px;font-weight:700;color:#eab308;margin-top:2px;"><?php echo $warns; ?></div>
            </div>
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;">
                <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">❌ Fouten</div>
                <div style="font-size:28px;font-weight:700;color:#ef4444;margin-top:2px;"><?php echo $fails; ?></div>
            </div>
            <div style="background:white;border:1px solid #e5e7eb;border-radius:10px;padding:14px;">
                <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">🔌 WordPress</div>
                <div style="font-size:16px;font-weight:700;color:#111827;margin-top:4px;"><?php echo get_bloginfo('version'); ?></div>
            </div>
            <div style="background:white;border:1px solid #e5e7eb;border-radius:10px;padding:14px;">
                <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">🐘 PHP</div>
                <div style="font-size:16px;font-weight:700;color:#111827;margin-top:4px;"><?php echo phpversion(); ?></div>
            </div>
            <div style="background:white;border:1px solid #e5e7eb;border-radius:10px;padding:14px;">
                <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">📦 Plugins</div>
                <div style="font-size:16px;font-weight:700;color:#111827;margin-top:4px;"><?php echo count(get_plugins()); ?></div>
            </div>
        </div>
    </div>

    <!-- Security Checks -->
    <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;">🔎 Security Checks</h2>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px;">
        <?php foreach ($audit['checks'] as $key => $check):
            $s_icon = $check['status'] === 'pass' ? '✅' : ($check['status'] === 'warn' ? '⚠️' : '❌');
            $s_bg = $check['status'] === 'pass' ? '#f0fdf4' : ($check['status'] === 'warn' ? '#fefce8' : '#fef2f2');
            $s_border = $check['status'] === 'pass' ? '#bbf7d0' : ($check['status'] === 'warn' ? '#fef08a' : '#fecaca');
            $cost = $fix_costs[$key] ?? 0;
            $can_fix = $check['status'] !== 'pass' && $cost > 0;
        ?>
        <div style="background:<?php echo $s_bg; ?>;border:1px solid <?php echo $s_border; ?>;border-radius:10px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div style="flex:1;">
                <div style="font-size:14px;font-weight:600;color:#111827;"><?php echo $s_icon; ?> <?php echo esc_html($check['label']); ?></div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;"><?php echo esc_html($check['detail']); ?></div>
                <?php if (!empty($check['fix']) && $check['status'] !== 'pass'): ?>
                <div style="font-size:11px;color:#6366f1;margin-top:3px;">💡 <?php echo esc_html($check['fix']); ?></div>
                <?php endif; ?>
            </div>
            
            <?php if ($can_fix): ?>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
                <button onclick="teSecurityFix('<?php echo esc_attr($key); ?>', <?php echo $cost; ?>, this)" 
                        style="background:#6366f1;color:white;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background 0.15s;" 
                        onmouseover="this.style.background='#4f46e5'" onmouseout="this.style.background='#6366f1'">
                    🔧 Fix Now
                </button>
                <span style="font-size:10px;color:#92400e;background:#fef3c7;padding:2px 8px;border-radius:12px;">🪙 <?php echo $cost; ?> tokens</span>
            </div>
            <?php elseif ($check['status'] === 'pass'): ?>
            <span style="font-size:20px;">✅</span>
            <?php endif; ?>
        </div>
        <?php endforeach; ?>
    </div>

    <!-- Rollback Points -->
    <?php
    $rollbacks = get_option('tinyeclipse_rollback_points', []);
    if (!empty($rollbacks)):
        // Filter out expired
        $active_rollbacks = array_filter($rollbacks, function($r) {
            return !isset($r['expires_at']) || strtotime($r['expires_at']) > time();
        });
    ?>
    <?php if (!empty($active_rollbacks)): ?>
    <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;">🔄 Actieve Rollback Punten</h2>
    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
                <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
                    <th style="padding:10px 12px;text-align:left;">Fix Type</th>
                    <th style="padding:10px 12px;text-align:left;">Datum</th>
                    <th style="padding:10px 12px;text-align:left;">Verloopt</th>
                    <th style="padding:10px 12px;text-align:left;">Gebruiker</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($active_rollbacks as $rid => $rb): ?>
            <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:10px 12px;font-weight:600;"><?php echo esc_html($rb['fix_type'] ?? '?'); ?></td>
                <td style="padding:10px 12px;color:#6b7280;"><?php echo esc_html($rb['timestamp'] ?? '?'); ?></td>
                <td style="padding:10px 12px;color:#6b7280;"><?php echo esc_html($rb['expires_at'] ?? '?'); ?></td>
                <td style="padding:10px 12px;">
                    <?php $u = get_user_by('id', $rb['user_id'] ?? 0); echo $u ? esc_html($u->display_name) : '?'; ?>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
    <?php endif; ?>

    <p style="text-align:center;color:#9ca3af;font-size:11px;">
        TinyEclipse Security v<?php echo TINYECLIPSE_VERSION; ?> · Rollback periode: 30 dagen
    </p>
</div>
<script>
function teSecurityFix(type, cost, btn) {
    var message = 'Security fix toepassen: ' + type + '\n\nKosten: ' + cost + ' tokens\n\nDeze fix wordt automatisch toegepast met een rollback periode van 30 dagen.\n\nDoorgaan?';
    if (!confirm(message)) return;
    
    var originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Bezig...';
    btn.disabled = true;
    btn.style.opacity = '0.6';
    
    jQuery.post(tinyeclipse.ajax_url, {
        action: 'tinyeclipse_security_fix',
        nonce: tinyeclipse.nonce,
        fix_type: type,
        auto_confirm: true
    }, function(r) {
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.style.opacity = '1';
        
        if (r.success) {
            alert('✅ ' + (r.data && r.data.message ? r.data.message : 'Fix toegepast!'));
            location.reload();
        } else {
            alert('❌ ' + (r.data && r.data.message ? r.data.message : 'Fout bij toepassen van fix'));
        }
    }).fail(function() {
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.style.opacity = '1';
        alert('❌ Verbinding fout. Probeer opnieuw.');
    });
}
</script>
