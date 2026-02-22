<?php
if (!defined('ABSPATH')) exit;

$site_id = tinyeclipse_get_tenant_id();
$connected = !empty($site_id);
$env = tinyeclipse_is_staging() ? 'staging' : 'production';
$env_color = tinyeclipse_is_staging() ? '#eab308' : '#22c55e';
$env_label = tinyeclipse_is_staging() ? '🟡 Staging' : '🟢 Production';

$balance = tinyeclipse_get_token_balance();
$last_sync = get_option('tinyeclipse_last_sync', null);

// Get clickable stats with drill-down data
$clickable_stats = tinyeclipse_get_clickable_stats();
$stats = [];
foreach ($clickable_stats as $key => $stat) {
    $stats[$key] = $stat['count'];
}

$stats['tokens'] = $balance['balance'];
$token_tier = $balance['tier_label'] ?? $balance['tier'];

// Module status — only show active ones
$modules = [];
$modules['security'] = class_exists('TinyEclipse_Security');
$modules['seo'] = class_exists('TinyEclipse_SEO');
$modules['mail'] = class_exists('TinyEclipse_Mail');
$modules['translation'] = class_exists('TinyEclipse_Translation') && function_exists('icl_get_languages');
$modules['forms'] = class_exists('TinyEclipse_Forms') && (function_exists('wpFluent') || class_exists('WPCF7'));
$modules['jobs'] = class_exists('TinyEclipse_Jobs') && post_type_exists('job_listing');
$modules['woocommerce'] = defined('TINYECLIPSE_WC_VERSION');
$modules['analytics'] = defined('TINYECLIPSE_ANALYTICS_VERSION');

$active_modules = array_filter($modules);
$total_modules = count($active_modules);

// Calculate site health score
$health_score = 50; // Base
if ($connected) $health_score += 10;
if ($modules['security']) $health_score += 10;
if ($modules['analytics']) $health_score += 10;
if ($modules['mail']) $health_score += 5;
if ($modules['seo']) $health_score += 5;
if ($modules['woocommerce']) $health_score += 5;
if ($balance['balance'] > 100) $health_score += 5;
$health_score = min(100, $health_score);
$health_color = $health_score >= 80 ? '#22c55e' : ($health_score >= 50 ? '#eab308' : '#ef4444');

// WP health data
$wp_version = get_bloginfo('version');
$php_version = phpversion();
$is_ssl = is_ssl();
$active_theme = wp_get_theme()->get('Name');
$plugin_count = count(get_option('active_plugins', []));
?>
<style>
.te-dash{max-width:1100px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.te-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;transition:all .2s}
.te-card:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.08);border-color:#6366f1}
.te-grid{display:grid;gap:12px}
.te-grid-4{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
.te-grid-3{grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
.te-grid-2{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.te-badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:4px}
.te-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid #e5e7eb;background:#fff;color:#374151;transition:all .15s}
.te-btn:hover{background:#f9fafb;border-color:#6366f1;color:#6366f1}
.te-btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none}
.te-btn-primary:hover{opacity:.9;transform:translateY(-1px)}
.te-section{margin-bottom:28px}
.te-section h2{font-size:15px;font-weight:600;color:#111827;margin:0 0 12px;display:flex;align-items:center;gap:8px}
.te-stat-label{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px}
.te-stat-value{font-size:26px;font-weight:700;color:#111827;margin-top:2px}
.te-health-ring{width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative}
.te-health-ring::before{content:'';position:absolute;inset:0;border-radius:50%;border:4px solid #f3f4f6}
.te-module-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:500;text-decoration:none;transition:all .15s}
.te-module-pill:hover{transform:translateY(-1px);box-shadow:0 2px 8px rgba(0,0,0,.08)}
@media(max-width:782px){.te-grid-4{grid-template-columns:1fr 1fr}.te-grid-3,.te-grid-2{grid-template-columns:1fr}}
</style>

<div class="wrap te-dash">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#9333ea);display:flex;align-items:center;justify-content:center;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <div>
                <h1 style="margin:0;font-size:22px;font-weight:700;">Eclipse Intelligence</h1>
                <p style="margin:2px 0 0;color:#6b7280;font-size:13px;"><?php echo esc_html(get_bloginfo('name')); ?> — v<?php echo TINYECLIPSE_VERSION; ?></p>
            </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
            <span class="te-badge" style="background:<?php echo $env_color; ?>15;color:<?php echo $env_color; ?>;"><?php echo $env_label; ?></span>
            <?php if ($connected): ?>
                <span class="te-badge" style="background:#dcfce7;color:#16a34a;">🔌 Connected</span>
            <?php else: ?>
                <span class="te-badge" style="background:#fef2f2;color:#dc2626;">⚠️ Disconnected</span>
            <?php endif; ?>
        </div>
    </div>

    <?php if (!$connected): ?>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h3 style="margin:0 0 8px;color:#991b1b;">⚠️ Niet verbonden met Eclipse HUB</h3>
        <p style="margin:0;color:#7f1d1d;font-size:14px;">Configureer je Tenant ID in <a href="<?php echo admin_url('admin.php?page=tinyeclipse-settings'); ?>">Settings</a> om AI, monitoring en analytics te activeren.</p>
    </div>
    <?php endif; ?>

    <!-- Intelligence Overview: Health + Quick Stats -->
    <div class="te-section">
        <div style="display:flex;gap:16px;align-items:stretch;flex-wrap:wrap;">
            <!-- Health Score Card -->
            <div class="te-card" style="flex:0 0 200px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
                <div class="te-health-ring" style="background:conic-gradient(<?php echo $health_color; ?> <?php echo $health_score * 3.6; ?>deg, #f3f4f6 0deg);">
                    <div style="width:64px;height:64px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column;">
                        <span style="font-size:22px;font-weight:800;color:<?php echo $health_color; ?>;"><?php echo $health_score; ?></span>
                        <span style="font-size:8px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Score</span>
                    </div>
                </div>
                <div style="margin-top:8px;font-size:12px;font-weight:600;color:<?php echo $health_color; ?>;">
                    <?php echo $health_score >= 80 ? 'Uitstekend' : ($health_score >= 50 ? 'Kan beter' : 'Actie nodig'); ?>
                </div>
                <div style="font-size:10px;color:#9ca3af;margin-top:2px;"><?php echo $total_modules; ?> modules actief</div>
            </div>

            <!-- Quick Stats -->
            <div style="flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">
                <?php
                $stat_icons = ['plugins' => '📦', 'pages' => '📄', 'posts' => '📝', 'users' => '👥', 'comments' => '💬', 'products' => '🛍️', 'orders' => '📦'];
                foreach ($stats as $key => $val):
                    if ($key === 'tokens') continue;
                    $stat_data = $clickable_stats[$key] ?? [];
                    $url = $stat_data['url'] ?? '#';
                    $label = $stat_data['label'] ?? ucfirst($key);
                    $drilldown = $stat_data['drilldown'] ?? [];
                ?>
                <a href="<?php echo esc_url($url); ?>" class="te-card" style="text-decoration:none;">
                    <div class="te-stat-label"><?php echo $stat_icons[$key] ?? '📊'; ?> <?php echo esc_html($label); ?></div>
                    <div class="te-stat-value"><?php echo number_format($val); ?></div>
                    <?php if (!empty($drilldown)): ?>
                    <div style="margin-top:6px;padding-top:6px;border-top:1px solid #f3f4f6;">
                        <?php foreach (array_slice($drilldown, 0, 2) as $item): ?>
                        <div style="font-size:10px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            • <?php echo esc_html($item['title'] ?? $item['name'] ?? $item['email'] ?? ''); ?>
                        </div>
                        <?php endforeach; ?>
                    </div>
                    <?php endif; ?>
                </a>
                <?php endforeach; ?>

                <!-- Token Card -->
                <div style="background:linear-gradient(135deg,#6366f1,#9333ea);border-radius:12px;padding:16px;color:white;position:relative;overflow:hidden;">
                    <div style="position:absolute;top:-10px;right:-10px;width:50px;height:50px;background:rgba(255,255,255,.1);border-radius:50%;"></div>
                    <div style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;justify-content:space-between;">
                        <span>🪙 Tokens</span>
                        <a href="<?php echo admin_url('admin.php?page=tinyeclipse-tokens'); ?>" style="color:white;text-decoration:none;font-size:10px;">→</a>
                    </div>
                    <div style="font-size:26px;font-weight:700;margin-top:2px;"><?php echo number_format($balance['balance']); ?></div>
                    <div style="font-size:10px;opacity:.7;"><?php echo esc_html($token_tier); ?></div>
                </div>
            </div>
        </div>
    </div>

    <!-- Site Intelligence Panel -->
    <div class="te-section">
        <h2>🧠 Site Intelligence</h2>
        <div class="te-grid te-grid-3">
            <!-- Environment Info -->
            <div class="te-card">
                <div class="te-stat-label">🖥️ Omgeving</div>
                <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;">
                        <span style="color:#6b7280;">WordPress</span>
                        <span style="font-weight:600;color:#111827;"><?php echo esc_html($wp_version); ?></span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;">
                        <span style="color:#6b7280;">PHP</span>
                        <span style="font-weight:600;color:<?php echo version_compare($php_version, '8.0', '>=') ? '#22c55e' : '#eab308'; ?>;"><?php echo esc_html($php_version); ?></span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;">
                        <span style="color:#6b7280;">SSL</span>
                        <span style="font-weight:600;color:<?php echo $is_ssl ? '#22c55e' : '#ef4444'; ?>;"><?php echo $is_ssl ? '✅ Actief' : '❌ Niet actief'; ?></span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;">
                        <span style="color:#6b7280;">Thema</span>
                        <span style="font-weight:600;color:#111827;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><?php echo esc_html($active_theme); ?></span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;">
                        <span style="color:#6b7280;">Plugins</span>
                        <span style="font-weight:600;color:#111827;"><?php echo $plugin_count; ?> actief</span>
                    </div>
                </div>
            </div>

            <!-- Health Checklist -->
            <div class="te-card">
                <div class="te-stat-label">✅ Gezondheid</div>
                <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">
                    <?php
                    $checks = [
                        ['Eclipse verbonden', $connected],
                        ['SSL actief', $is_ssl],
                        ['PHP 8.0+', version_compare($php_version, '8.0', '>=')],
                        ['Security module', $modules['security']],
                        ['Analytics actief', $modules['analytics']],
                        ['SEO module', $modules['seo']],
                        ['Mail/SMTP', $modules['mail']],
                        ['Tokens beschikbaar', $balance['balance'] > 0],
                    ];
                    foreach ($checks as $check):
                    ?>
                    <div style="display:flex;align-items:center;gap:6px;font-size:12px;">
                        <span style="color:<?php echo $check[1] ? '#22c55e' : '#ef4444'; ?>;"><?php echo $check[1] ? '✓' : '✗'; ?></span>
                        <span style="color:<?php echo $check[1] ? '#374151' : '#9ca3af'; ?>;"><?php echo esc_html($check[0]); ?></span>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- AI Recommendations -->
            <div class="te-card" style="border-color:#6366f120;background:linear-gradient(135deg,#faf5ff,#f0f0ff);">
                <div class="te-stat-label">💡 Aanbevelingen</div>
                <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">
                    <?php
                    $recommendations = [];
                    if (!$modules['security']) $recommendations[] = ['🔒', 'Activeer Security module voor site-bescherming', 'high'];
                    if (!$modules['analytics']) $recommendations[] = ['📊', 'Activeer Analytics voor bezoekersdata', 'high'];
                    if (!$modules['seo']) $recommendations[] = ['🔍', 'Activeer SEO module voor zoekmachine-optimalisatie', 'medium'];
                    if (!$is_ssl) $recommendations[] = ['🔐', 'SSL certificaat ontbreekt — beveilig je site', 'high'];
                    if (!$modules['mail']) $recommendations[] = ['📧', 'Configureer SMTP voor betrouwbare e-mail', 'medium'];
                    if ($balance['balance'] < 50) $recommendations[] = ['🪙', 'Token saldo is laag — vul aan voor AI functies', 'medium'];
                    if (version_compare($php_version, '8.0', '<')) $recommendations[] = ['⚡', 'Upgrade naar PHP 8.0+ voor betere performance', 'low'];
                    if (empty($recommendations)) $recommendations[] = ['🎉', 'Alles ziet er goed uit! Blijf monitoren.', 'none'];
                    
                    foreach (array_slice($recommendations, 0, 4) as $rec):
                        $priority_color = $rec[2] === 'high' ? '#ef4444' : ($rec[2] === 'medium' ? '#eab308' : '#22c55e');
                    ?>
                    <div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;padding:4px 0;">
                        <span><?php echo $rec[0]; ?></span>
                        <span style="color:#374151;line-height:1.4;"><?php echo esc_html($rec[1]); ?></span>
                        <?php if ($rec[2] !== 'none'): ?>
                        <span style="flex-shrink:0;width:6px;height:6px;border-radius:50%;background:<?php echo $priority_color; ?>;margin-top:4px;"></span>
                        <?php endif; ?>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    </div>

    <!-- Active Modules (only show active ones as pills) -->
    <div class="te-section">
        <h2>⚡ Actieve Modules (<?php echo $total_modules; ?>)</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <?php
            $module_info = [
                'security'    => ['icon' => '🔒', 'label' => 'Security', 'page' => 'tinyeclipse-security', 'color' => '#22c55e', 'bg' => '#f0fdf4'],
                'seo'         => ['icon' => '🔍', 'label' => 'SEO', 'page' => 'tinyeclipse-seo', 'color' => '#3b82f6', 'bg' => '#eff6ff'],
                'mail'        => ['icon' => '📧', 'label' => 'Mail', 'page' => 'tinyeclipse-mail', 'color' => '#f97316', 'bg' => '#fff7ed'],
                'translation' => ['icon' => '🌐', 'label' => 'Translation', 'page' => 'tinyeclipse-translation', 'color' => '#8b5cf6', 'bg' => '#faf5ff'],
                'forms'       => ['icon' => '📋', 'label' => 'Forms', 'page' => 'tinyeclipse-forms', 'color' => '#a855f7', 'bg' => '#faf5ff'],
                'jobs'        => ['icon' => '💼', 'label' => 'Jobs', 'page' => 'tinyeclipse-jobs', 'color' => '#6366f1', 'bg' => '#eef2ff'],
                'woocommerce' => ['icon' => '🛒', 'label' => 'WooCommerce', 'page' => 'tinyeclipse-wc', 'color' => '#7c3aed', 'bg' => '#f5f3ff'],
                'analytics'   => ['icon' => '📊', 'label' => 'Analytics', 'page' => 'tinyeclipse-analytics', 'color' => '#ec4899', 'bg' => '#fdf2f8'],
            ];
            foreach ($module_info as $key => $info):
                $active = $modules[$key] ?? false;
                if (!$active) continue;
            ?>
            <a href="<?php echo admin_url('admin.php?page=' . $info['page']); ?>" class="te-module-pill" style="background:<?php echo $info['bg']; ?>;color:<?php echo $info['color']; ?>;border:1px solid <?php echo $info['color']; ?>20;text-decoration:none;">
                <span><?php echo $info['icon']; ?></span>
                <span style="font-weight:600;"><?php echo $info['label']; ?></span>
                <span style="font-size:10px;opacity:.6;">●</span>
            </a>
            <?php endforeach; ?>

            <?php
            // Show inactive modules as greyed-out with "activate" hint
            foreach ($module_info as $key => $info):
                $active = $modules[$key] ?? false;
                if ($active) continue;
            ?>
            <span class="te-module-pill" style="background:#f9fafb;color:#9ca3af;border:1px solid #e5e7eb;cursor:default;">
                <span style="opacity:.5;"><?php echo $info['icon']; ?></span>
                <span><?php echo $info['label']; ?></span>
            </span>
            <?php endforeach; ?>
        </div>
    </div>

    <!-- Quick Actions -->
    <div class="te-section">
        <h2>🚀 Acties</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="teAction('scan')" class="te-btn">🔍 Scan</button>
            <button onclick="teAction('report')" class="te-btn">📊 Rapport</button>
            <button onclick="teAction('heartbeat')" class="te-btn">💓 Heartbeat</button>
            <?php if ($connected): ?>
            <a href="<?php echo esc_url(TINYECLIPSE_HUB_URL); ?>" target="_blank" class="te-btn te-btn-primary">🌐 Eclipse Hub</a>
            <?php endif; ?>
        </div>
    </div>

    <!-- Footer -->
    <?php if ($last_sync): ?>
    <p style="color:#9ca3af;font-size:11px;">Laatste sync: <?php echo esc_html($last_sync); ?></p>
    <?php endif; ?>
    <p style="text-align:center;margin-top:24px;color:#d1d5db;font-size:10px;">
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
