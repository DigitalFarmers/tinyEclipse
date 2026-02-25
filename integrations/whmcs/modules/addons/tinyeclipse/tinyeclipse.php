<?php
/**
 * TinyEclipse WHMCS Addon Module
 * Provides SSO, provisioning hooks, admin overview, and client area widget.
 *
 * Install: copy this folder to /path/to/whmcs/modules/addons/tinyeclipse/
 */

if (!defined("WHMCS")) die("This file cannot be accessed directly");

use WHMCS\Database\Capsule;

// ─── Module Configuration ───

function tinyeclipse_config() {
    return [
        'name'        => 'TinyEclipse',
        'description' => 'AI-powered website management — monitoring, analytics, chat & cross-site intelligence.',
        'version'     => '2.0.0',
        'author'      => 'Digital Farmers',
        'language'     => 'english',
        'fields'      => [
            'api_url' => [
                'FriendlyName' => 'API URL',
                'Type'         => 'text',
                'Size'         => 60,
                'Default'      => 'https://api.tinyeclipse.digitalfarmers.be',
                'Description'  => 'TinyEclipse API base URL',
            ],
            'portal_url' => [
                'FriendlyName' => 'Portal URL',
                'Type'         => 'text',
                'Size'         => 60,
                'Default'      => 'https://tinyeclipse.digitalfarmers.be/portal',
                'Description'  => 'Client portal base URL',
            ],
            'admin_key' => [
                'FriendlyName' => 'Admin API Key',
                'Type'         => 'password',
                'Size'         => 60,
                'Description'  => 'Hub admin API key for provisioning',
            ],
            'sso_secret' => [
                'FriendlyName' => 'SSO Secret',
                'Type'         => 'password',
                'Size'         => 60,
                'Description'  => 'Shared secret for SSO signature (must match APP_SECRET_KEY)',
            ],
        ],
    ];
}

// ─── Addon Activation / Deactivation ───

function tinyeclipse_activate() {
    try {
        if (!Capsule::schema()->hasTable('mod_tinyeclipse_links')) {
            Capsule::schema()->create('mod_tinyeclipse_links', function ($table) {
                $table->increments('id');
                $table->integer('client_id')->unsigned();
                $table->integer('service_id')->unsigned()->nullable();
                $table->string('tenant_id', 36);
                $table->string('domain', 255);
                $table->string('plan', 20)->default('tiny');
                $table->enum('status', ['active', 'suspended', 'terminated'])->default('active');
                $table->timestamp('created_at')->useCurrent();
                $table->timestamp('updated_at')->nullable();
                $table->unique(['client_id', 'tenant_id']);
                $table->index('client_id');
                $table->index('tenant_id');
            });
        }
        return ['status' => 'success', 'description' => 'TinyEclipse addon activated.'];
    } catch (\Exception $e) {
        return ['status' => 'error', 'description' => $e->getMessage()];
    }
}

function tinyeclipse_deactivate() {
    // Don't drop table — keep data safe
    return ['status' => 'success', 'description' => 'TinyEclipse addon deactivated. Data preserved.'];
}

// ─── Admin Area Output ───

function tinyeclipse_output($vars) {
    $api_url = $vars['api_url'];
    $admin_key = $vars['admin_key'];

    // Fetch all linked clients
    $links = Capsule::table('mod_tinyeclipse_links')
        ->where('status', 'active')
        ->orderBy('created_at', 'desc')
        ->get();

    echo '<h2>TinyEclipse — Connected Sites</h2>';

    if ($links->isEmpty()) {
        echo '<div class="alert alert-info">Geen gekoppelde sites. Sites worden automatisch gekoppeld bij provisioning.</div>';
        return;
    }

    echo '<table class="datatable" width="100%" border="0" cellspacing="1" cellpadding="3">';
    echo '<tr><th>Client</th><th>Domain</th><th>Plan</th><th>Tenant ID</th><th>Status</th><th>Actions</th></tr>';

    foreach ($links as $link) {
        $client = Capsule::table('tblclients')->where('id', $link->client_id)->first();
        $client_name = $client ? ($client->firstname . ' ' . $client->lastname) : "#{$link->client_id}";
        $status_badge = $link->status === 'active'
            ? '<span class="label label-success">Active</span>'
            : '<span class="label label-warning">' . ucfirst($link->status) . '</span>';

        echo "<tr>";
        echo "<td><a href='clientssummary.php?userid={$link->client_id}'>{$client_name}</a></td>";
        echo "<td>{$link->domain}</td>";
        echo "<td>{$link->plan}</td>";
        echo "<td><code style='font-size:10px'>{$link->tenant_id}</code></td>";
        echo "<td>{$status_badge}</td>";
        echo "<td><a href='{$api_url}/docs' target='_blank' class='btn btn-xs btn-default'>API</a></td>";
        echo "</tr>";
    }

    echo '</table>';

    // Quick stats from Hub
    echo '<br><h3>Hub Status</h3>';
    $stats = _tinyeclipse_api_call($api_url, '/api/admin/tenants/', $admin_key);
    if ($stats && is_array($stats)) {
        $total = count($stats);
        $prod = count(array_filter($stats, function ($t) { return ($t['environment'] ?? '') === 'production'; }));
        echo "<p><strong>{$total}</strong> tenants totaal, <strong>{$prod}</strong> productie.</p>";
    } else {
        echo '<div class="alert alert-warning">Kan Hub niet bereiken. Check API URL en key.</div>';
    }
}

// ─── Client Area Output (Addon Page) ───

function tinyeclipse_clientarea($vars) {
    $client_id = $_SESSION['uid'] ?? 0;
    if (!$client_id) return '';

    $links = Capsule::table('mod_tinyeclipse_links')
        ->where('client_id', $client_id)
        ->where('status', 'active')
        ->get();

    if ($links->isEmpty()) return '';

    $output = '<div class="tinyeclipse-widget">';
    foreach ($links as $link) {
        $output .= _tinyeclipse_render_command_center($link, $vars);
    }
    $output .= '</div>';
    return $output;
}


// ─── Product Details Hook — shows TinyEclipse on product page ───

add_hook('ClientAreaProductDetailsOutput', 1, function ($vars) {
    $client_id = $_SESSION['uid'] ?? 0;
    $service_id = $vars['serviceid'] ?? 0;
    if (!$client_id || !$service_id) return '';

    $link = Capsule::table('mod_tinyeclipse_links')
        ->where('client_id', $client_id)
        ->where('service_id', $service_id)
        ->where('status', 'active')
        ->first();

    // If not matched by service_id, try matching by client_id (first active)
    if (!$link) {
        $link = Capsule::table('mod_tinyeclipse_links')
            ->where('client_id', $client_id)
            ->where('status', 'active')
            ->first();
    }

    if (!$link) return '';

    $settings = _tinyeclipse_settings();
    return _tinyeclipse_render_command_center($link, $settings);
});


// ─── Render the full Command Center UI ───

function _tinyeclipse_render_command_center($link, $vars) {
    $api_url = $vars['api_url'];
    $portal_url = $vars['portal_url'];
    $sso_secret = $vars['sso_secret'];
    $admin_key = $vars['admin_key'];

    $sso_url = _tinyeclipse_sso_url($link->tenant_id, $sso_secret, $portal_url);
    $stats = _tinyeclipse_api_call($api_url, "/api/track/analytics/{$link->tenant_id}?hours=168", $admin_key);
    $config = _tinyeclipse_api_call($api_url, "/api/sites/config/{$link->tenant_id}", null);

    // Generate portal token for command execution
    $ts = time();
    $sig = hash_hmac('sha256', $link->tenant_id . ':' . $ts, $sso_secret);
    $portal_token = $ts . ':' . $sig;

    $plan = $link->plan;
    $plan_label = strtoupper($plan === 'pro_plus' ? 'PRO+' : $plan);
    $domain = $link->domain;
    $brain_v = $config['mother_brain']['intelligence_version'] ?? '?';
    $widget_enabled = $config['widget']['enabled'] ?? true;
    $status_color = $widget_enabled ? '#4ade80' : '#f87171';
    $status_label = $widget_enabled ? 'Online' : 'Offline';

    $o = '';
    $o .= '<style>
        .te { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .te-panel { background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0d1b2a 100%); border-radius: 16px; padding: 0; margin: 20px 0; color: #fff; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.3); }
        .te-header { padding: 24px 28px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; }
        .te-header-left { display: flex; align-items: center; gap: 14px; }
        .te-logo { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 22px; }
        .te-header h3 { margin: 0; font-size: 18px; font-weight: 700; color: #fff; }
        .te-header-sub { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 2px; }
        .te-header-right { display: flex; align-items: center; gap: 10px; }
        .te-status { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .te-status-on { background: rgba(74,222,128,0.1); color: #4ade80; border: 1px solid rgba(74,222,128,0.2); }
        .te-status-off { background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.2); }
        .te-status-dot { width: 7px; height: 7px; border-radius: 50%; animation: te-pulse 2s infinite; }
        @keyframes te-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .te-plan-badge { background: rgba(99,102,241,0.15); color: #a5b4fc; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; border: 1px solid rgba(99,102,241,0.2); }

        .te-body { padding: 24px 28px; }
        .te-stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .te-stat-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; text-align: center; transition: all 0.2s; }
        .te-stat-card:hover { background: rgba(255,255,255,0.06); border-color: rgba(99,102,241,0.3); }
        .te-stat-val { font-size: 26px; font-weight: 800; background: linear-gradient(135deg, #60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1.2; }
        .te-stat-lbl { font-size: 10px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px; }

        .te-section-title { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px; margin: 0 0 14px; display: flex; align-items: center; gap: 8px; }
        .te-section-title::after { content: ""; flex: 1; height: 1px; background: rgba(255,255,255,0.06); }

        .te-commands { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-bottom: 24px; }
        .te-cmd { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; }
        .te-cmd:hover { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.3); transform: translateY(-1px); }
        .te-cmd.te-cmd-disabled { opacity: 0.4; cursor: not-allowed; }
        .te-cmd.te-cmd-disabled:hover { transform: none; background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.08); }
        .te-cmd-icon { font-size: 20px; margin-bottom: 8px; }
        .te-cmd-name { font-size: 13px; font-weight: 600; color: #fff; }
        .te-cmd-desc { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 3px; line-height: 1.4; }
        .te-cmd-cooldown { position: absolute; top: 8px; right: 8px; font-size: 9px; color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; }
        .te-cmd.te-cmd-running { border-color: rgba(250,204,21,0.4); }
        .te-cmd.te-cmd-running .te-cmd-name::after { content: " ⏳"; }
        .te-cmd.te-cmd-success { border-color: rgba(74,222,128,0.4); }
        .te-cmd.te-cmd-success .te-cmd-name::after { content: " ✓"; }

        .te-actions { display: flex; gap: 10px; flex-wrap: wrap; padding: 20px 28px; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.15); }
        .te-btn-primary { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 10px 24px; border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s; }
        .te-btn-primary:hover { opacity: 0.9; color: #fff; text-decoration: none; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
        .te-btn-secondary { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7); padding: 10px 24px; border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: 500; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; transition: all 0.2s; }
        .te-btn-secondary:hover { background: rgba(255,255,255,0.1); color: #fff; text-decoration: none; }

        .te-toast { position: fixed; bottom: 30px; right: 30px; padding: 12px 20px; border-radius: 10px; font-size: 13px; font-weight: 500; color: #fff; z-index: 99999; animation: te-slide-in 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .te-toast-success { background: linear-gradient(135deg, #059669, #10b981); }
        .te-toast-error { background: linear-gradient(135deg, #dc2626, #ef4444); }
        .te-toast-info { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
        @keyframes te-slide-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        .te-info-row { display: flex; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
        .te-info-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 8px; font-size: 11px; color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
        .te-info-chip strong { color: rgba(255,255,255,0.8); }
    </style>';

    // ─── Panel Start ───
    $o .= '<div class="te te-panel">';

    // ─── Header ───
    $o .= '<div class="te-header">';
    $o .= '<div class="te-header-left">';
    $o .= '<div class="te-logo">⚡</div>';
    $o .= '<div>';
    $o .= "<h3>TinyEclipse</h3>";
    $o .= "<div class='te-header-sub'>{$domain}</div>";
    $o .= '</div>';
    $o .= '</div>';
    $o .= '<div class="te-header-right">';
    $o .= '<span class="te-status ' . ($widget_enabled ? 'te-status-on' : 'te-status-off') . '">';
    $o .= "<span class='te-status-dot' style='background:{$status_color}'></span> {$status_label}";
    $o .= '</span>';
    $o .= "<span class='te-plan-badge'>{$plan_label}</span>";
    $o .= '</div>';
    $o .= '</div>';

    // ─── Body ───
    $o .= '<div class="te-body">';

    // Info chips
    $o .= '<div class="te-info-row">';
    $o .= "<div class='te-info-chip'>🧠 Intelligence <strong>v{$brain_v}</strong></div>";
    if ($config && isset($config['features'])) {
        $active_features = count(array_filter($config['features']));
        $total_features = count($config['features']);
        $o .= "<div class='te-info-chip'>🔧 Features <strong>{$active_features}/{$total_features} actief</strong></div>";
    }
    $o .= "<div class='te-info-chip'>🌐 Taal <strong>" . strtoupper($config['default_language'] ?? 'nl') . "</strong></div>";
    $o .= '</div>';

    // Stats
    if ($stats && isset($stats['summary'])) {
        $s = $stats['summary'];
        $o .= '<div class="te-stats-row">';
        $o .= '<div class="te-stat-card"><div class="te-stat-val">' . ($s['total_sessions'] ?? 0) . '</div><div class="te-stat-lbl">Sessies (7d)</div></div>';
        $o .= '<div class="te-stat-card"><div class="te-stat-val">' . ($s['total_pageviews'] ?? 0) . '</div><div class="te-stat-lbl">Pageviews</div></div>';
        $o .= '<div class="te-stat-card"><div class="te-stat-val">' . round($s['bounce_rate'] ?? 0, 1) . '%</div><div class="te-stat-lbl">Bounce</div></div>';
        $o .= '<div class="te-stat-card"><div class="te-stat-val">' . ($s['total_conversations'] ?? 0) . '</div><div class="te-stat-lbl">Gesprekken</div></div>';
        $o .= '<div class="te-stat-card"><div class="te-stat-val">' . round($s['conversion_rate'] ?? 0, 1) . '%</div><div class="te-stat-lbl">Conversie</div></div>';
        $o .= '</div>';
    }

    // Command Icons mapping
    $cmd_icons = [
        'sync'          => '🔄',
        'heartbeat'     => '💚',
        'flush_cache'   => '🗑️',
        'security_scan' => '🛡️',
        'deep_scan'     => '🔍',
        'report'        => '📄',
        'update_config' => '📤',
        'scan'          => '⚡',
    ];

    // Command labels (server-side fallback — real labels come from API)
    $cmd_labels = [
        'sync'          => ['Sync Content',    'Synchroniseer website content met AI kennisbank'],
        'heartbeat'     => ['Health Check',     'Snelle gezondheidscheck van je site'],
        'flush_cache'   => ['Cache Legen',      'Wis alle caches (pagina, object, CDN)'],
        'security_scan' => ['Security Scan',    'Volledige beveiligingsaudit'],
        'deep_scan'     => ['Deep Scan',        'Volledige site-intelligentie scan'],
        'report'        => ['Rapport',          'Genereer een volledig statusrapport'],
        'update_config' => ['Push Config',      'Push laatste configuratie naar je site'],
        'scan'          => ['Quick Scan',       'Snelle scan van site vitals en modules'],
    ];

    // Allowed commands per plan (mirrors backend)
    $plan_commands = [
        'tiny'     => ['sync', 'heartbeat'],
        'pro'      => ['sync', 'heartbeat', 'flush_cache', 'security_scan', 'deep_scan', 'report'],
        'pro_plus' => ['sync', 'heartbeat', 'flush_cache', 'security_scan', 'deep_scan', 'report', 'update_config', 'scan'],
    ];

    $allowed = $plan_commands[$plan] ?? $plan_commands['tiny'];
    $all_cmds = array_keys($cmd_labels);

    // Commands Section
    $o .= '<div class="te-section-title">Commando\'s</div>';
    $o .= '<div class="te-commands">';

    foreach ($all_cmds as $cmd) {
        $is_allowed = in_array($cmd, $allowed);
        $icon = $cmd_icons[$cmd] ?? '⚙️';
        $label = $cmd_labels[$cmd][0] ?? $cmd;
        $desc = $cmd_labels[$cmd][1] ?? '';
        $disabled_class = $is_allowed ? '' : 'te-cmd-disabled';
        $onclick = $is_allowed
            ? "teExecCmd(this, '{$cmd}', '{$link->tenant_id}', '{$portal_token}')"
            : '';
        $title = $is_allowed ? '' : "title='Upgrade naar een hoger plan voor dit commando'";

        $o .= "<div class='te-cmd {$disabled_class}' id='te-cmd-{$cmd}' onclick=\"{$onclick}\" {$title}>";
        $o .= "<div class='te-cmd-icon'>{$icon}</div>";
        $o .= "<div class='te-cmd-name'>{$label}</div>";
        $o .= "<div class='te-cmd-desc'>{$desc}</div>";
        if (!$is_allowed) {
            $o .= "<div class='te-cmd-cooldown'>🔒 " . strtoupper($plan === 'pro_plus' ? 'PRO+' : 'PRO') . "</div>";
        }
        $o .= '</div>';
    }

    $o .= '</div>'; // commands
    $o .= '</div>'; // body

    // ─── Actions Footer ───
    $o .= '<div class="te-actions">';
    $o .= "<a href='{$sso_url}' target='_blank' class='te-btn-primary'>⚡ Open Volledig Dashboard</a>";
    $o .= "<a href='{$portal_url}/login' target='_blank' class='te-btn-secondary'>🔑 Portal Login</a>";
    $o .= '</div>';

    $o .= '</div>'; // panel

    // ─── JavaScript for AJAX command execution ───
    $api_base = rtrim($api_url, '/');
    $o .= "<script>
    function teExecCmd(el, cmdType, tenantId, token) {
        if (el.classList.contains('te-cmd-disabled') || el.classList.contains('te-cmd-running')) return;

        el.classList.add('te-cmd-running');
        el.classList.remove('te-cmd-success');

        var xhr = new XMLHttpRequest();
        xhr.open('POST', '{$api_base}/api/portal/commands/execute');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function() {
            el.classList.remove('te-cmd-running');
            if (xhr.status >= 200 && xhr.status < 300) {
                var data = JSON.parse(xhr.responseText);
                el.classList.add('te-cmd-success');
                teToast(data.message || (cmdType + ' gestart'), 'success');
                setTimeout(function() { el.classList.remove('te-cmd-success'); }, 5000);
            } else if (xhr.status === 429) {
                teToast('Even geduld — cooldown actief', 'info');
            } else {
                var err = 'Fout bij uitvoeren';
                try { err = JSON.parse(xhr.responseText).detail || err; } catch(e) {}
                teToast(err, 'error');
            }
        };
        xhr.onerror = function() {
            el.classList.remove('te-cmd-running');
            teToast('Kan geen verbinding maken met TinyEclipse', 'error');
        };
        xhr.send(JSON.stringify({
            tenant_id: tenantId,
            token: token,
            command_type: cmdType,
            payload: {}
        }));
    }

    function teToast(msg, type) {
        var t = document.createElement('div');
        t.className = 'te-toast te-toast-' + type;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(function() { t.style.opacity = '0'; t.style.transform = 'translateY(20px)'; t.style.transition = 'all 0.3s'; }, 3000);
        setTimeout(function() { t.remove(); }, 3500);
    }
    </script>";

    return $o;
}

// ─── Provisioning Hooks ───

add_hook('AfterModuleCreate', 1, function ($vars) {
    _tinyeclipse_provision($vars, 'create');
});

add_hook('AfterModuleSuspend', 1, function ($vars) {
    _tinyeclipse_update_link_status($vars['params']['serviceid'] ?? 0, 'suspended');
});

add_hook('AfterModuleUnsuspend', 1, function ($vars) {
    _tinyeclipse_update_link_status($vars['params']['serviceid'] ?? 0, 'active');
});

add_hook('AfterModuleTerminate', 1, function ($vars) {
    _tinyeclipse_update_link_status($vars['params']['serviceid'] ?? 0, 'terminated');
});

// ─── Plan Upgrade/Downgrade Hook ───

add_hook('AfterModuleChangePackage', 1, function ($vars) {
    $service_id = $vars['params']['serviceid'] ?? 0;
    $link = Capsule::table('mod_tinyeclipse_links')->where('service_id', $service_id)->first();
    if (!$link) return;

    $new_plan = _tinyeclipse_detect_plan($vars['params']);
    if ($new_plan && $new_plan !== $link->plan) {
        Capsule::table('mod_tinyeclipse_links')
            ->where('id', $link->id)
            ->update(['plan' => $new_plan, 'updated_at' => date('Y-m-d H:i:s')]);

        // Notify Hub
        $settings = _tinyeclipse_settings();
        _tinyeclipse_api_call($settings['api_url'], "/api/admin/whmcs/plan-change", $settings['admin_key'], 'POST', [
            'tenant_id' => $link->tenant_id,
            'old_plan' => $link->plan,
            'new_plan' => $new_plan,
        ]);
    }
});

// ─── SSO Sidebar Hook ───

add_hook('ClientAreaPrimarySidebar', 1, function ($sidebar) {
    if (!isset($_SESSION['uid'])) return;

    $client_id = $_SESSION['uid'];
    $links = Capsule::table('mod_tinyeclipse_links')
        ->where('client_id', $client_id)
        ->where('status', 'active')
        ->get();

    if ($links->isEmpty()) return;

    $settings = _tinyeclipse_settings();

    $panel = $sidebar->getChild('My Account');
    if (!$panel) $panel = $sidebar->addChild('My Account');

    foreach ($links as $i => $link) {
        $sso_url = _tinyeclipse_sso_url($link->tenant_id, $settings['sso_secret'], $settings['portal_url']);
        $label = $links->count() > 1 ? "⚡ {$link->domain}" : '⚡ Website Dashboard';
        $panel->addChild("TinyEclipse_{$i}", [
            'label' => $label,
            'uri'   => $sso_url,
            'order' => 1 + $i,
            'icon'  => 'fa-bolt',
            'attributes' => ['target' => '_blank'],
        ]);
    }
});

// ─── Helper Functions ───

function _tinyeclipse_settings() {
    $settings = [];
    $rows = Capsule::table('tbladdonmodules')
        ->where('module', 'tinyeclipse')
        ->get();
    foreach ($rows as $row) {
        $settings[$row->setting] = $row->value;
    }
    return $settings;
}

function _tinyeclipse_sso_url($tenant_id, $secret, $portal_url) {
    $ts = time();
    $msg = $tenant_id . ':' . $ts;
    $sig = hash_hmac('sha256', $msg, $secret);
    return $portal_url . '?sso=' . $tenant_id . ':' . $ts . ':' . $sig;
}

function _tinyeclipse_api_call($api_url, $path, $admin_key, $method = 'GET', $body = null) {
    $url = rtrim($api_url, '/') . $path;
    $ch = curl_init($url);
    $headers = [
        'X-Admin-Key: ' . $admin_key,
        'Content-Type: application/json',
    ];
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($body) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code >= 200 && $code < 300) {
        return json_decode($response, true);
    }
    return null;
}

function _tinyeclipse_provision($vars, $action) {
    $params = $vars['params'] ?? [];
    $client_id = $params['clientsdetails']['userid'] ?? ($params['userid'] ?? 0);
    $service_id = $params['serviceid'] ?? 0;
    $domain = $params['domain'] ?? '';

    if (!$client_id || !$domain) return;

    $plan = _tinyeclipse_detect_plan($params);
    $settings = _tinyeclipse_settings();

    // Call Hub to provision tenant
    $result = _tinyeclipse_api_call($settings['api_url'], '/api/admin/whmcs/provision', $settings['admin_key'], 'POST', [
        'client_id'       => (int) $client_id,
        'domain'          => $domain,
        'plan'            => $plan,
        'service_id'      => $service_id,
        'company_name'    => $params['clientsdetails']['companyname'] ?? '',
        'email'           => $params['clientsdetails']['email'] ?? '',
    ]);

    if ($result && !empty($result['tenant_id'])) {
        // Upsert link
        Capsule::table('mod_tinyeclipse_links')->updateOrInsert(
            ['client_id' => $client_id, 'tenant_id' => $result['tenant_id']],
            [
                'service_id' => $service_id,
                'domain'     => $domain,
                'plan'       => $plan,
                'status'     => 'active',
                'updated_at' => date('Y-m-d H:i:s'),
            ]
        );

        logActivity("TinyEclipse: Provisioned tenant {$result['tenant_id']} for {$domain} (client #{$client_id})");
    }
}

function _tinyeclipse_update_link_status($service_id, $status) {
    if (!$service_id) return;

    $link = Capsule::table('mod_tinyeclipse_links')->where('service_id', $service_id)->first();
    if (!$link) return;

    Capsule::table('mod_tinyeclipse_links')
        ->where('id', $link->id)
        ->update(['status' => $status, 'updated_at' => date('Y-m-d H:i:s')]);

    // Notify Hub
    $settings = _tinyeclipse_settings();
    _tinyeclipse_api_call($settings['api_url'], '/api/admin/whmcs/status-change', $settings['admin_key'], 'POST', [
        'tenant_id' => $link->tenant_id,
        'status'    => $status,
    ]);

    logActivity("TinyEclipse: Tenant {$link->tenant_id} status changed to {$status}");
}

function _tinyeclipse_detect_plan($params) {
    $product_name = strtolower($params['configoption1'] ?? ($params['productname'] ?? ''));
    if (strpos($product_name, 'pro+') !== false || strpos($product_name, 'proplus') !== false) return 'pro_plus';
    if (strpos($product_name, 'pro') !== false) return 'pro';
    return 'tiny';
}
