<?php
if (!defined('ABSPATH')) exit;
$balance = tinyeclipse_get_token_balance();
$usage = TinyEclipse_Tokens::instance()->get_usage(get_current_user_id(), 20);
$is_super = tinyeclipse_is_superadmin();
$all_balances = $is_super ? TinyEclipse_Tokens::instance()->get_all_balances() : [];
?>
<div class="wrap" style="max-width:900px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <h1 style="font-size:22px;margin-bottom:20px;">🪙 Token System</h1>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
        <div style="background:linear-gradient(135deg,#6366f1,#9333ea);border-radius:12px;padding:16px;color:white;text-align:center;">
            <div style="font-size:11px;opacity:0.8;text-transform:uppercase;">Saldo</div>
            <div style="font-size:32px;font-weight:700;"><?php echo number_format($balance['balance']); ?></div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Plan</div>
            <div style="font-size:20px;font-weight:700;color:#111827;"><?php echo esc_html($balance['tier_label'] ?? $balance['tier']); ?></div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Maandelijks</div>
            <div style="font-size:20px;font-weight:700;color:#111827;"><?php echo number_format($balance['monthly_tokens'] ?? 0); ?></div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Totaal Gebruikt</div>
            <div style="font-size:20px;font-weight:700;color:#111827;"><?php echo number_format($balance['lifetime_used']); ?></div>
        </div>
    </div>

    <!-- Token Costs -->
    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
        <h3 style="margin:0 0 12px;font-size:15px;">Token Kosten per Actie</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;">
            <?php foreach (TinyEclipse_Tokens::COSTS as $action => $cost): ?>
            <div style="background:#f9fafb;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;">
                <span style="font-size:13px;color:#374151;"><?php echo esc_html($action); ?></span>
                <span style="font-size:13px;font-weight:600;color:#6366f1;"><?php echo $cost; ?> 🪙</span>
            </div>
            <?php endforeach; ?>
        </div>
    </div>

    <!-- Usage Log -->
    <?php if (!empty($usage)): ?>
    <h2 style="font-size:16px;margin-bottom:12px;">Recente Activiteit</h2>
    <table class="widefat striped" style="border-radius:10px;overflow:hidden;margin-bottom:24px;">
        <thead><tr><th>Actie</th><th>Tokens</th><th>Saldo na</th><th>Datum</th></tr></thead>
        <tbody>
        <?php foreach ($usage as $log): ?>
        <tr>
            <td><?php echo esc_html($log['action']); ?></td>
            <td style="color:<?php echo $log['tokens_used'] > 0 ? '#ef4444' : '#22c55e'; ?>;"><?php echo $log['tokens_used'] > 0 ? '-' . $log['tokens_used'] : '+' . abs($log['tokens_used']); ?></td>
            <td><?php echo number_format($log['balance_after']); ?></td>
            <td><?php echo esc_html($log['created_at']); ?></td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>

    <!-- Superadmin: All Users -->
    <?php if ($is_super && !empty($all_balances)): ?>
    <h2 style="font-size:16px;margin-bottom:12px;">👑 Alle Gebruikers (Superadmin)</h2>
    <table class="widefat striped" style="border-radius:10px;overflow:hidden;">
        <thead><tr><th>Gebruiker</th><th>Email</th><th>Tier</th><th>Saldo</th><th>Gebruikt</th><th>Acties</th></tr></thead>
        <tbody>
        <?php foreach ($all_balances as $u): ?>
        <tr>
            <td><?php echo esc_html($u['name']); ?></td>
            <td><?php echo esc_html($u['email']); ?></td>
            <td><strong><?php echo esc_html($u['tier']); ?></strong></td>
            <td><?php echo number_format($u['balance']); ?></td>
            <td><?php echo number_format($u['lifetime_used']); ?></td>
            <td>
                <button onclick="teTopUp(<?php echo $u['user_id']; ?>)" class="button button-small">+100</button>
                <select onchange="teSetTier(<?php echo $u['user_id']; ?>,this.value)" style="font-size:11px;">
                    <option value="">Tier...</option>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="pro+">Pro+</option>
                    <option value="enterprise">Enterprise</option>
                </select>
            </td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>
</div>
<script>
function teTopUp(uid) {
    jQuery.post(tinyeclipse.ajax_url, {action:'tinyeclipse_token_top_up',nonce:tinyeclipse.nonce,user_id:uid,amount:100}, function(r) {
        if (r.success) location.reload(); else alert('❌ ' + (r.data||'Fout'));
    });
}
function teSetTier(uid, tier) {
    if (!tier) return;
    jQuery.post(tinyeclipse.ajax_url, {action:'tinyeclipse_token_set_tier',nonce:tinyeclipse.nonce,user_id:uid,tier:tier}, function(r) {
        if (r.success) location.reload(); else alert('❌ ' + (r.data||'Fout'));
    });
}
</script>
