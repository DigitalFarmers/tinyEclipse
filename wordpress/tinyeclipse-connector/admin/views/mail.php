<?php
if (!defined('ABSPATH')) exit;
$audit = TinyEclipse_Mail::instance()->audit();
$icon = $audit['score'] >= 80 ? '🟢' : ($audit['score'] >= 50 ? '🟡' : '🔴');
$color = $audit['score'] >= 80 ? '#22c55e' : ($audit['score'] >= 50 ? '#eab308' : '#ef4444');

// DNS record checks
$domain = parse_url(get_site_url(), PHP_URL_HOST);
$dns_checks = [];

// SPF check
$txt_records = @dns_get_record($domain, DNS_TXT);
$spf_found = false;
$spf_value = '';
if ($txt_records) {
    foreach ($txt_records as $r) {
        if (isset($r['txt']) && strpos($r['txt'], 'v=spf1') !== false) {
            $spf_found = true;
            $spf_value = $r['txt'];
            break;
        }
    }
}
$dns_checks['spf'] = [
    'label' => 'SPF Record',
    'status' => $spf_found ? 'pass' : 'fail',
    'detail' => $spf_found ? $spf_value : 'Geen SPF record gevonden — mails kunnen als spam worden gemarkeerd',
    'fix' => !$spf_found ? 'Voeg een TXT record toe: v=spf1 include:_spf.google.com ~all (pas aan voor je provider)' : null,
];

// DKIM check (common selectors)
$dkim_found = false;
$dkim_selector = '';
foreach (['default', 'google', 'mail', 'dkim', 'selector1', 'selector2', 'k1', 's1'] as $sel) {
    $dkim_records = @dns_get_record($sel . '._domainkey.' . $domain, DNS_TXT);
    if ($dkim_records && !empty($dkim_records[0]['txt'])) {
        $dkim_found = true;
        $dkim_selector = $sel;
        break;
    }
}
$dns_checks['dkim'] = [
    'label' => 'DKIM Record',
    'status' => $dkim_found ? 'pass' : 'warn',
    'detail' => $dkim_found ? "DKIM gevonden (selector: {$dkim_selector})" : 'Geen DKIM record gevonden — configureer bij je e-mail provider',
    'fix' => !$dkim_found ? 'Voeg een DKIM TXT record toe via je e-mail provider (Google Workspace, Outlook, etc.)' : null,
];

// DMARC check
$dmarc_records = @dns_get_record('_dmarc.' . $domain, DNS_TXT);
$dmarc_found = false;
$dmarc_value = '';
if ($dmarc_records) {
    foreach ($dmarc_records as $r) {
        if (isset($r['txt']) && strpos($r['txt'], 'v=DMARC1') !== false) {
            $dmarc_found = true;
            $dmarc_value = $r['txt'];
            break;
        }
    }
}
$dns_checks['dmarc'] = [
    'label' => 'DMARC Record',
    'status' => $dmarc_found ? 'pass' : 'warn',
    'detail' => $dmarc_found ? $dmarc_value : 'Geen DMARC record — aanbevolen voor e-mail authenticatie',
    'fix' => !$dmarc_found ? 'Voeg TXT record toe: _dmarc.' . $domain . ' → v=DMARC1; p=quarantine; rua=mailto:admin@' . $domain : null,
];

// MX check
$mx_records = @dns_get_record($domain, DNS_MX);
$mx_found = !empty($mx_records);
$mx_hosts = [];
if ($mx_records) {
    foreach ($mx_records as $mx) {
        $mx_hosts[] = $mx['target'] . ' (pri ' . $mx['pri'] . ')';
    }
}
$dns_checks['mx'] = [
    'label' => 'MX Records',
    'status' => $mx_found ? 'pass' : 'fail',
    'detail' => $mx_found ? implode(', ', array_slice($mx_hosts, 0, 3)) : 'Geen MX records — domein kan geen e-mail ontvangen',
];

$dns_score = 0;
foreach ($dns_checks as $dc) { if ($dc['status'] === 'pass') $dns_score += 25; elseif ($dc['status'] === 'warn') $dns_score += 10; }
$dns_color = $dns_score >= 80 ? '#22c55e' : ($dns_score >= 50 ? '#eab308' : '#ef4444');
?>
<div class="wrap" style="max-width:1200px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#9333ea);display:flex;align-items:center;justify-content:center;">
                <span style="font-size:22px;">📧</span>
            </div>
            <div>
                <h1 style="margin:0;font-size:22px;font-weight:700;">Mail & DNS Audit</h1>
                <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">SMTP configuratie + DNS-level e-mail verificatie voor <?php echo esc_html($domain); ?></p>
            </div>
        </div>
        <div style="display:flex;gap:8px;">
            <?php if ($audit['smtp_active']): ?>
            <button onclick="teTestEmail()" class="button button-primary" style="border-radius:8px;">📧 Test Email Sturen</button>
            <?php endif; ?>
            <button onclick="location.reload()" class="button" style="border-radius:8px;">🔄 Opnieuw scannen</button>
        </div>
    </div>

    <!-- Score Cards Row -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">📧 SMTP Score</div>
            <div style="font-size:32px;font-weight:800;color:<?php echo $color; ?>;margin-top:4px;"><?php echo $audit['score']; ?>%</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px;"><?php echo $audit['smtp_plugin'] ? '🔌 ' . esc_html($audit['smtp_plugin']) : '⚠️ Geen SMTP'; ?></div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">🌐 DNS Score</div>
            <div style="font-size:32px;font-weight:800;color:<?php echo $dns_color; ?>;margin-top:4px;"><?php echo $dns_score; ?>%</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px;"><?php echo $domain; ?></div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">📬 Admin Email</div>
            <div style="font-size:14px;font-weight:600;color:#111827;margin-top:8px;word-break:break-all;"><?php echo esc_html(get_option('admin_email')); ?></div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">📮 MX Records</div>
            <div style="font-size:32px;font-weight:800;color:<?php echo $mx_found ? '#22c55e' : '#ef4444'; ?>;margin-top:4px;"><?php echo count($mx_records ?: []); ?></div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px;"><?php echo $mx_found ? '✅ Actief' : '❌ Ontbreekt'; ?></div>
        </div>
    </div>

    <!-- Two Column Layout -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
        <!-- SMTP Checks -->
        <div>
            <h2 style="font-size:15px;font-weight:600;margin-bottom:10px;">📧 SMTP Configuratie</h2>
            <div style="display:flex;flex-direction:column;gap:6px;">
                <?php foreach ($audit['checks'] as $key => $check):
                    $s = $check['status'] === 'pass' ? '✅' : ($check['status'] === 'warn' ? '⚠️' : ($check['status'] === 'info' ? 'ℹ️' : '❌'));
                    $bg = $check['status'] === 'pass' ? '#f0fdf4' : ($check['status'] === 'warn' ? '#fefce8' : ($check['status'] === 'info' ? '#eff6ff' : '#fef2f2'));
                    $bd = $check['status'] === 'pass' ? '#bbf7d0' : ($check['status'] === 'warn' ? '#fef08a' : ($check['status'] === 'info' ? '#bfdbfe' : '#fecaca'));
                ?>
                <div style="background:<?php echo $bg; ?>;border:1px solid <?php echo $bd; ?>;border-radius:8px;padding:10px 14px;">
                    <div style="font-size:13px;font-weight:600;color:#111827;"><?php echo $s; ?> <?php echo esc_html($check['label']); ?></div>
                    <div style="font-size:11px;color:#6b7280;margin-top:1px;"><?php echo esc_html($check['detail']); ?></div>
                    <?php if (!empty($check['fix'])): ?>
                    <div style="font-size:10px;color:#6366f1;margin-top:3px;">� <?php echo esc_html($check['fix']); ?></div>
                    <?php endif; ?>
                    <?php if (!empty($check['connections'])): ?>
                    <div style="margin-top:6px;">
                        <?php foreach ($check['connections'] as $conn): ?>
                        <div style="font-size:10px;color:#374151;background:white;border-radius:4px;padding:4px 8px;margin-top:3px;">
                            <strong><?php echo esc_html($conn['provider'] ?? '?'); ?></strong> — <?php echo esc_html($conn['from_email'] ?? ''); ?>
                        </div>
                        <?php endforeach; ?>
                    </div>
                    <?php endif; ?>
                </div>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- DNS Checks -->
        <div>
            <h2 style="font-size:15px;font-weight:600;margin-bottom:10px;">🌐 DNS E-mail Records</h2>
            <div style="display:flex;flex-direction:column;gap:6px;">
                <?php foreach ($dns_checks as $key => $check):
                    $s = $check['status'] === 'pass' ? '✅' : ($check['status'] === 'warn' ? '⚠️' : '❌');
                    $bg = $check['status'] === 'pass' ? '#f0fdf4' : ($check['status'] === 'warn' ? '#fefce8' : '#fef2f2');
                    $bd = $check['status'] === 'pass' ? '#bbf7d0' : ($check['status'] === 'warn' ? '#fef08a' : '#fecaca');
                ?>
                <div style="background:<?php echo $bg; ?>;border:1px solid <?php echo $bd; ?>;border-radius:8px;padding:10px 14px;">
                    <div style="font-size:13px;font-weight:600;color:#111827;"><?php echo $s; ?> <?php echo esc_html($check['label']); ?></div>
                    <div style="font-size:11px;color:#6b7280;margin-top:1px;word-break:break-all;"><?php echo esc_html($check['detail']); ?></div>
                    <?php if (!empty($check['fix'])): ?>
                    <div style="font-size:10px;color:#6366f1;margin-top:3px;word-break:break-all;">💡 <?php echo esc_html($check['fix']); ?></div>
                    <?php endif; ?>
                </div>
                <?php endforeach; ?>

                <!-- DNS Summary -->
                <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-top:4px;">
                    <div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:6px;">📋 DNS Samenvatting voor <?php echo esc_html($domain); ?></div>
                    <div style="font-size:11px;color:#6b7280;line-height:1.6;">
                        SPF: <?php echo $spf_found ? '✅' : '❌'; ?> · 
                        DKIM: <?php echo $dkim_found ? '✅' : '❌'; ?> · 
                        DMARC: <?php echo $dmarc_found ? '✅' : '❌'; ?> · 
                        MX: <?php echo $mx_found ? '✅' : '❌'; ?>
                    </div>
                    <?php if (!$spf_found || !$dkim_found || !$dmarc_found): ?>
                    <div style="font-size:10px;color:#ef4444;margin-top:4px;">⚠️ Ontbrekende DNS records verhogen het risico dat e-mails in spam belanden</div>
                    <?php else: ?>
                    <div style="font-size:10px;color:#22c55e;margin-top:4px;">✅ Alle e-mail DNS records zijn correct geconfigureerd</div>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>

    <!-- Action Buttons -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <?php if (!$audit['smtp_active']): ?>
        <a href="<?php echo admin_url('plugin-install.php?s=fluentsmtp&tab=search&type=term'); ?>" class="button button-primary" style="border-radius:8px;">� FluentSMTP Installeren</a>
        <?php else: ?>
        <a href="<?php echo admin_url('admin.php?page=fluentmail'); ?>" class="button" style="border-radius:8px;">⚙️ FluentSMTP Settings</a>
        <?php endif; ?>
        <a href="https://mxtoolbox.com/SuperTool.aspx?action=mx%3a<?php echo urlencode($domain); ?>&run=toolpage" target="_blank" class="button" style="border-radius:8px;">🔍 MXToolbox Check</a>
        <a href="https://www.mail-tester.com/" target="_blank" class="button" style="border-radius:8px;">� Mail-Tester.com</a>
    </div>

    <p style="text-align:center;margin-top:24px;color:#9ca3af;font-size:11px;">
        DNS checks uitgevoerd op: <?php echo date('d/m/Y H:i'); ?> · Domein: <?php echo esc_html($domain); ?>
    </p>
</div>
<script>
function teTestEmail() {
    if (!confirm('Test email sturen naar <?php echo esc_js(get_option('admin_email')); ?>?')) return;
    jQuery.post(tinyeclipse.ajax_url, {action:'tinyeclipse_test_email',nonce:tinyeclipse.nonce}, function(r) {
        alert(r.success ? '✅ Test email verzonden naar <?php echo esc_js(get_option('admin_email')); ?>!' : '❌ ' + (r.data||'Fout bij verzenden'));
    });
}
</script>
