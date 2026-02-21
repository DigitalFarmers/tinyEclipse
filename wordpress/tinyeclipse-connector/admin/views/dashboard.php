<?php
if (!defined('ABSPATH')) exit;

$site_id = tinyeclipse_get_tenant_id();
$connected = !empty($site_id);
$env = tinyeclipse_is_staging() ? 'staging' : 'production';
$env_color = tinyeclipse_is_staging() ? '#eab308' : '#22c55e';
$env_label = tinyeclipse_is_staging() ? '🟡 Staging' : '🟢 Production';

$balance = tinyeclipse_get_token_balance();
$last_sync = get_option('tinyeclipse_last_sync', null);

// Quick stats
$stats = [
    'plugins'  => count(get_option('active_plugins', [])),
    'pages'    => wp_count_posts('page')->publish,
    'posts'    => wp_count_posts('post')->publish,
    'users'    => count_users()['total_users'] ?? 0,
    'comments' => wp_count_comments()->approved,
];

if (class_exists('WooCommerce')) {
    $stats['products'] = wp_count_posts('product')->publish;
    $stats['orders'] = wp_count_posts('shop_order')->{'wc-completed'} ?? 0;
}

// Module status
$modules = [];
$modules['security'] = class_exists('TinyEclipse_Security');
$modules['seo'] = class_exists('TinyEclipse_SEO');
$modules['mail'] = class_exists('TinyEclipse_Mail');
$modules['translation'] = class_exists('TinyEclipse_Translation') && function_exists('icl_get_languages');
$modules['forms'] = class_exists('TinyEclipse_Forms') && (function_exists('wpFluent') || class_exists('WPCF7'));
$modules['jobs'] = class_exists('TinyEclipse_Jobs') && post_type_exists('job_listing');
$modules['woocommerce'] = defined('TINYECLIPSE_WC_VERSION');
$modules['analytics'] = defined('TINYECLIPSE_ANALYTICS_VERSION');
?>
<div class="wrap" style="max-width:1100px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#9333ea);display:flex;align-items:center;justify-content:center;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <div>
                <h1 style="margin:0;font-size:22px;font-weight:700;">TinyEclipse Dashboard</h1>
                <p style="margin:2px 0 0;color:#6b7280;font-size:13px;"><?php echo esc_html(get_bloginfo('name')); ?> — v<?php echo TINYECLIPSE_VERSION; ?></p>
            </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
            <span style="background:<?php echo $env_color; ?>20;color:<?php echo $env_color; ?>;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500;"><?php echo $env_label; ?></span>
            <?php if ($connected): ?>
                <span style="background:#dcfce7;color:#16a34a;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500;">🔌 Connected</span>
            <?php else: ?>
                <span style="background:#fef2f2;color:#dc2626;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500;">⚠️ Not connected</span>
            <?php endif; ?>
        </div>
    </div>

    <?php if (!$connected): ?>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h3 style="margin:0 0 8px;color:#991b1b;">⚠️ Niet verbonden</h3>
        <p style="margin:0;color:#7f1d1d;font-size:14px;">Configureer je Tenant ID in <a href="<?php echo admin_url('admin.php?page=tinyeclipse-settings'); ?>">Settings</a> om TinyEclipse te activeren.</p>
    </div>
    <?php endif; ?>

    <!-- Stats Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:24px;">
        <?php
        $stat_icons = ['plugins' => '📦', 'pages' => '📄', 'posts' => '📝', 'users' => '👥', 'comments' => '💬', 'products' => '🛍️', 'orders' => '📦'];
        foreach ($stats as $key => $val): ?>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;"><?php echo $stat_icons[$key] ?? '📊'; ?> <?php echo ucfirst($key); ?></div>
            <div style="font-size:28px;font-weight:700;color:#111827;margin-top:4px;"><?php echo number_format($val); ?></div>
        </div>
        <?php endforeach; ?>

        <!-- Token balance -->
        <div style="background:linear-gradient(135deg,#6366f1,#9333ea);border-radius:12px;padding:16px;color:white;">
            <div style="font-size:11px;opacity:0.8;text-transform:uppercase;letter-spacing:0.5px;">🪙 Tokens</div>
            <div style="font-size:28px;font-weight:700;margin-top:4px;"><?php echo number_format($balance['balance']); ?></div>
            <div style="font-size:11px;opacity:0.7;margin-top:2px;"><?php echo esc_html($balance['tier_label'] ?? $balance['tier']); ?></div>
        </div>
    </div>

    <!-- Modules Grid -->
    <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;">Modules</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:24px;">
        <?php
        $module_info = [
            'security'    => ['icon' => '🔒', 'label' => 'Security', 'page' => 'tinyeclipse-security'],
            'seo'         => ['icon' => '🔍', 'label' => 'SEO', 'page' => 'tinyeclipse-seo'],
            'mail'        => ['icon' => '📧', 'label' => 'Mail/SMTP', 'page' => 'tinyeclipse-mail'],
            'translation' => ['icon' => '🌐', 'label' => 'Translation', 'page' => 'tinyeclipse-translation'],
            'forms'       => ['icon' => '📋', 'label' => 'Forms', 'page' => 'tinyeclipse-forms'],
            'jobs'        => ['icon' => '💼', 'label' => 'Jobs', 'page' => 'tinyeclipse-jobs'],
            'woocommerce' => ['icon' => '🛒', 'label' => 'WooCommerce', 'page' => 'tinyeclipse-wc'],
            'analytics'   => ['icon' => '📊', 'label' => 'Analytics', 'page' => 'tinyeclipse-analytics'],
        ];
        foreach ($module_info as $key => $info):
            $active = $modules[$key] ?? false;
            $color = $active ? '#22c55e' : '#9ca3af';
            $bg = $active ? '#f0fdf4' : '#f9fafb';
            $border = $active ? '#bbf7d0' : '#e5e7eb';
        ?>
        <a href="<?php echo $active ? admin_url('admin.php?page=' . $info['page']) : '#'; ?>" style="background:<?php echo $bg; ?>;border:1px solid <?php echo $border; ?>;border-radius:12px;padding:16px;text-decoration:none;display:block;">
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:20px;"><?php echo $info['icon']; ?></span>
                <div>
                    <div style="font-size:14px;font-weight:600;color:#111827;"><?php echo $info['label']; ?></div>
                    <div style="font-size:11px;color:<?php echo $color; ?>;font-weight:500;"><?php echo $active ? '● Active' : '○ Inactive'; ?></div>
                </div>
            </div>
        </a>
        <?php endforeach; ?>
    </div>

    <!-- Quick Actions -->
    <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;">Snelacties</h2>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px;">
        <button onclick="teAction('scan')" class="button" style="display:flex;align-items:center;gap:6px;">🔍 Scan uitvoeren</button>
        <button onclick="teAction('report')" class="button" style="display:flex;align-items:center;gap:6px;">📊 Rapport genereren</button>
        <button onclick="teAction('heartbeat')" class="button" style="display:flex;align-items:center;gap:6px;">💓 Heartbeat</button>
        <?php if ($connected): ?>
        <a href="<?php echo esc_url(TINYECLIPSE_HUB_URL); ?>" target="_blank" class="button button-primary" style="display:flex;align-items:center;gap:6px;">🌐 Eclipse Hub openen</a>
        <?php endif; ?>
    </div>

    <!-- Last Sync -->
    <?php if ($last_sync): ?>
    <p style="color:#9ca3af;font-size:12px;">Laatste sync: <?php echo esc_html($last_sync); ?></p>
    <?php endif; ?>

    <p style="text-align:center;margin-top:32px;color:#9ca3af;font-size:11px;">
        TinyEclipse v<?php echo TINYECLIPSE_VERSION; ?> — <a href="<?php echo esc_url(TINYECLIPSE_HUB_URL); ?>" target="_blank" style="color:#6366f1;">Eclipse HUB</a> — <a href="https://digitalfarmers.be" target="_blank" style="color:#6366f1;">Digital Farmers</a>
    </p>
</div>

<script>
function teAction(type) {
    jQuery.post(tinyeclipse.ajax_url, {
        action: 'tinyeclipse_run_action',
        nonce: tinyeclipse.nonce,
        action_type: type
    }, function(res) {
        if (res.success) alert('✅ ' + type + ' uitgevoerd!');
        else alert('❌ Fout: ' + (res.data || 'Onbekend'));
    });
}
</script>
