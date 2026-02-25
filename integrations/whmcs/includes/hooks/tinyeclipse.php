<?php
/**
 * TinyEclipse — WHMCS Global Hooks
 *
 * This file MUST be placed in: /path/to/whmcs/includes/hooks/tinyeclipse.php
 * It loads on every WHMCS page, unlike addon module hooks which only load on addon pages.
 */

use WHMCS\Database\Capsule;

// ─── Product Details: TinyEclipse Command Center ───

add_hook('ClientAreaProductDetailsOutput', 1, function ($vars) {
    $client_id = $_SESSION['uid'] ?? 0;
    $service_id = $vars['serviceid'] ?? 0;
    if (!$client_id || !$service_id) return '';

    // Check if addon table exists
    try {
        if (!Capsule::schema()->hasTable('mod_tinyeclipse_links')) return '';
    } catch (\Exception $e) {
        return '';
    }

    // Find linked site
    $link = Capsule::table('mod_tinyeclipse_links')
        ->where('client_id', $client_id)
        ->where('service_id', $service_id)
        ->where('status', 'active')
        ->first();

    // Fallback: match by client_id (first active link)
    if (!$link) {
        $link = Capsule::table('mod_tinyeclipse_links')
            ->where('client_id', $client_id)
            ->where('status', 'active')
            ->first();
    }

    if (!$link) return '';

    // Load addon settings
    $settings = [];
    $rows = Capsule::table('tbladdonmodules')
        ->where('module', 'tinyeclipse')
        ->pluck('value', 'setting');
    foreach ($rows as $k => $v) { $settings[$k] = $v; }

    if (empty($settings['api_url']) || empty($settings['sso_secret'])) return '';

    // ─── Render Command Center ───
    return _te_hooks_render_command_center($link, $settings);
});


// ─── SSO Sidebar Link ───

add_hook('ClientAreaPrimarySidebar', 1, function ($sidebar) {
    if (!isset($_SESSION['uid'])) return;
    $client_id = $_SESSION['uid'];

    try {
        if (!Capsule::schema()->hasTable('mod_tinyeclipse_links')) return;
    } catch (\Exception $e) {
        return;
    }

    $link = Capsule::table('mod_tinyeclipse_links')
        ->where('client_id', $client_id)
        ->where('status', 'active')
        ->first();

    if (!$link) return;

    $settings = [];
    $rows = Capsule::table('tbladdonmodules')
        ->where('module', 'tinyeclipse')
        ->pluck('value', 'setting');
    foreach ($rows as $k => $v) { $settings[$k] = $v; }

    if (empty($settings['sso_secret']) || empty($settings['portal_url'])) return;

    $ts = time();
    $sig = hash_hmac('sha256', $link->tenant_id . ':' . $ts, $settings['sso_secret']);
    $sso_url = $settings['portal_url'] . '?sso=' . $link->tenant_id . ':' . $ts . ':' . $sig;

    if (!is_null($sidebar->getChild('Service Details Actions'))) {
        $sidebar->getChild('Service Details Actions')
            ->addChild('tinyeclipse-sso', [
                'label' => '⚡ TinyEclipse Dashboard',
                'uri'   => $sso_url,
                'order' => 99,
                'attributes' => ['target' => '_blank'],
            ]);
    }
});


// ═══════════════════════════════════════════════════════════
// RENDER FUNCTION — Full Command Center UI
// ═══════════════════════════════════════════════════════════

function _te_hooks_render_command_center($link, $vars) {
    $api_url  = $vars['api_url'] ?? '';
    $portal_url = $vars['portal_url'] ?? '';
    $sso_secret = $vars['sso_secret'] ?? '';
    $admin_key  = $vars['admin_key'] ?? '';

    if (!$api_url || !$sso_secret) return '';

    // SSO URL
    $ts = time();
    $sig = hash_hmac('sha256', $link->tenant_id . ':' . $ts, $sso_secret);
    $sso_url = $portal_url . '?sso=' . $link->tenant_id . ':' . $ts . ':' . $sig;
    $portal_token = $ts . ':' . $sig;

    // Fetch stats + config from Hub
    $stats  = _te_hooks_api($api_url, "/api/track/analytics/{$link->tenant_id}?hours=168", $admin_key);
    $config = _te_hooks_api($api_url, "/api/sites/config/{$link->tenant_id}", null);

    $plan = $link->plan ?? 'tiny';
    $plan_label = strtoupper($plan === 'pro_plus' ? 'PRO+' : $plan);
    $domain = $link->domain ?? '?';
    $brain_v = $config['mother_brain']['intelligence_version'] ?? '—';
    $widget_on = $config['widget']['enabled'] ?? true;
    $status_color = $widget_on ? '#4ade80' : '#f87171';
    $status_label = $widget_on ? 'Online' : 'Offline';

    $o = '';

    // ─── CSS ───
    $o .= '<style>
.te{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.te-panel{background:linear-gradient(135deg,#0f0f23 0%,#1a1a3e 50%,#0d1b2a 100%);border-radius:16px;padding:0;margin:20px 0;color:#fff;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.3)}
.te-hdr{padding:24px 28px 20px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
.te-hdr-l{display:flex;align-items:center;gap:14px}
.te-logo{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:22px}
.te-hdr h3{margin:0;font-size:18px;font-weight:700;color:#fff}
.te-hdr-sub{font-size:12px;color:rgba(255,255,255,.4);margin-top:2px}
.te-hdr-r{display:flex;align-items:center;gap:10px}
.te-status{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:600}
.te-st-on{background:rgba(74,222,128,.1);color:#4ade80;border:1px solid rgba(74,222,128,.2)}
.te-st-off{background:rgba(248,113,113,.1);color:#f87171;border:1px solid rgba(248,113,113,.2)}
.te-dot{width:7px;height:7px;border-radius:50%;animation:tepulse 2s infinite}
@keyframes tepulse{0%,100%{opacity:1}50%{opacity:.4}}
.te-badge{background:rgba(99,102,241,.15);color:#a5b4fc;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.5px;border:1px solid rgba(99,102,241,.2)}
.te-body{padding:24px 28px}
.te-chips{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.te-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:8px;font-size:11px;color:rgba(255,255,255,.5);background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)}
.te-chip strong{color:rgba(255,255,255,.8)}
.te-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;margin-bottom:24px}
.te-s{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px;text-align:center;transition:all .2s}
.te-s:hover{background:rgba(255,255,255,.06);border-color:rgba(99,102,241,.3)}
.te-sv{font-size:26px;font-weight:800;background:linear-gradient(135deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1.2}
.te-sl{font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.8px;margin-top:4px}
.te-sec{font-size:13px;font-weight:600;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1px;margin:0 0 14px;display:flex;align-items:center;gap:8px}
.te-sec::after{content:"";flex:1;height:1px;background:rgba(255,255,255,.06)}
.te-cmds{display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:10px;margin-bottom:24px}
.te-c{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden}
.te-c:hover{background:rgba(99,102,241,.08);border-color:rgba(99,102,241,.3);transform:translateY(-1px)}
.te-c.off{opacity:.4;cursor:not-allowed}
.te-c.off:hover{transform:none;background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.08)}
.te-ci{font-size:20px;margin-bottom:8px}
.te-cn{font-size:13px;font-weight:600;color:#fff}
.te-cd{font-size:10px;color:rgba(255,255,255,.35);margin-top:3px;line-height:1.4}
.te-cl{position:absolute;top:8px;right:8px;font-size:9px;color:rgba(255,255,255,.2);background:rgba(255,255,255,.05);padding:2px 6px;border-radius:4px}
.te-c.run{border-color:rgba(250,204,21,.4)}
.te-c.run .te-cn::after{content:" ⏳"}
.te-c.ok{border-color:rgba(74,222,128,.4)}
.te-c.ok .te-cn::after{content:" ✓"}
.te-foot{display:flex;gap:10px;flex-wrap:wrap;padding:20px 28px;border-top:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.15)}
.te-bp{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:10px 24px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:all .2s}
.te-bp:hover{opacity:.9;color:#fff;text-decoration:none;transform:translateY(-1px);box-shadow:0 4px 12px rgba(99,102,241,.3)}
.te-bs{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.7);padding:10px 24px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:500;border:1px solid rgba(255,255,255,.1);cursor:pointer;transition:all .2s}
.te-bs:hover{background:rgba(255,255,255,.1);color:#fff;text-decoration:none}
.te-toast{position:fixed;bottom:30px;right:30px;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:500;color:#fff;z-index:99999;animation:teslide .3s ease;box-shadow:0 4px 20px rgba(0,0,0,.3)}
.te-toast-ok{background:linear-gradient(135deg,#059669,#10b981)}
.te-toast-err{background:linear-gradient(135deg,#dc2626,#ef4444)}
.te-toast-info{background:linear-gradient(135deg,#6366f1,#8b5cf6)}
@keyframes teslide{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
</style>';

    // ─── Panel ───
    $o .= '<div class="te te-panel">';

    // Header
    $o .= '<div class="te-hdr">';
    $o .= '<div class="te-hdr-l"><div class="te-logo">⚡</div><div>';
    $o .= "<h3>TinyEclipse</h3><div class='te-hdr-sub'>{$domain}</div></div></div>";
    $o .= '<div class="te-hdr-r">';
    $o .= '<span class="te-status ' . ($widget_on ? 'te-st-on' : 'te-st-off') . '">';
    $o .= "<span class='te-dot' style='background:{$status_color}'></span> {$status_label}</span>";
    $o .= "<span class='te-badge'>{$plan_label}</span>";
    $o .= '</div></div>';

    // Body
    $o .= '<div class="te-body">';

    // Info chips
    $o .= '<div class="te-chips">';
    $o .= "<div class='te-chip'>🧠 Intelligence <strong>v{$brain_v}</strong></div>";
    if ($config && isset($config['features'])) {
        $af = count(array_filter($config['features']));
        $tf = count($config['features']);
        $o .= "<div class='te-chip'>🔧 Features <strong>{$af}/{$tf} actief</strong></div>";
    }
    $lang = strtoupper($config['default_language'] ?? 'nl');
    $o .= "<div class='te-chip'>🌐 Taal <strong>{$lang}</strong></div>";
    $o .= '</div>';

    // Stats
    if ($stats && isset($stats['summary'])) {
        $s = $stats['summary'];
        $o .= '<div class="te-stats">';
        $o .= '<div class="te-s"><div class="te-sv">' . ($s['total_sessions'] ?? 0) . '</div><div class="te-sl">Sessies (7d)</div></div>';
        $o .= '<div class="te-s"><div class="te-sv">' . ($s['total_pageviews'] ?? 0) . '</div><div class="te-sl">Pageviews</div></div>';
        $o .= '<div class="te-s"><div class="te-sv">' . round($s['bounce_rate'] ?? 0, 1) . '%</div><div class="te-sl">Bounce</div></div>';
        $o .= '<div class="te-s"><div class="te-sv">' . ($s['total_conversations'] ?? 0) . '</div><div class="te-sl">Gesprekken</div></div>';
        $o .= '<div class="te-s"><div class="te-sv">' . round($s['conversion_rate'] ?? 0, 1) . '%</div><div class="te-sl">Conversie</div></div>';
        $o .= '</div>';
    }

    // Commands
    $cmd_map = [
        'sync'          => ['🔄', 'Sync Content',    'Synchroniseer content met AI kennisbank'],
        'heartbeat'     => ['💚', 'Health Check',     'Snelle gezondheidscheck van je site'],
        'flush_cache'   => ['🗑️', 'Cache Legen',      'Wis alle caches (pagina, object, CDN)'],
        'security_scan' => ['🛡️', 'Security Scan',    'Volledige beveiligingsaudit'],
        'deep_scan'     => ['🔍', 'Deep Scan',        'Volledige site-intelligentie scan'],
        'report'        => ['📄', 'Rapport',          'Genereer een volledig statusrapport'],
        'update_config' => ['📤', 'Push Config',      'Push laatste configuratie naar je site'],
        'scan'          => ['⚡', 'Quick Scan',       'Snelle scan van site vitals en modules'],
    ];

    $plan_cmds = [
        'tiny'     => ['sync', 'heartbeat'],
        'pro'      => ['sync', 'heartbeat', 'flush_cache', 'security_scan', 'deep_scan', 'report'],
        'pro_plus' => ['sync', 'heartbeat', 'flush_cache', 'security_scan', 'deep_scan', 'report', 'update_config', 'scan'],
    ];

    $allowed = $plan_cmds[$plan] ?? $plan_cmds['tiny'];

    $o .= '<div class="te-sec">Commando\'s</div>';
    $o .= '<div class="te-cmds">';

    foreach ($cmd_map as $cmd => $meta) {
        $ok = in_array($cmd, $allowed);
        $cls = $ok ? '' : 'off';
        $click = $ok ? "teCmd(this,'{$cmd}','{$link->tenant_id}','{$portal_token}')" : '';
        $tip = $ok ? '' : "title='Upgrade naar een hoger plan'";

        $o .= "<div class='te-c {$cls}' onclick=\"{$click}\" {$tip}>";
        $o .= "<div class='te-ci'>{$meta[0]}</div>";
        $o .= "<div class='te-cn'>{$meta[1]}</div>";
        $o .= "<div class='te-cd'>{$meta[2]}</div>";
        if (!$ok) {
            $min_plan = in_array($cmd, $plan_cmds['pro']) ? 'PRO' : 'PRO+';
            $o .= "<div class='te-cl'>🔒 {$min_plan}</div>";
        }
        $o .= '</div>';
    }

    $o .= '</div></div>'; // cmds + body

    // Footer
    $o .= '<div class="te-foot">';
    $o .= "<a href='{$sso_url}' target='_blank' class='te-bp'>⚡ Open Volledig Dashboard</a>";
    $o .= "<a href='{$portal_url}/login' target='_blank' class='te-bs'>🔑 Portal Login</a>";
    $o .= '</div></div>'; // foot + panel

    // JavaScript
    $api_base = rtrim($api_url, '/');
    $o .= "<script>
function teCmd(el,t,tid,tok){
 if(el.classList.contains('off')||el.classList.contains('run'))return;
 el.classList.add('run');el.classList.remove('ok');
 var x=new XMLHttpRequest();
 x.open('POST','{$api_base}/api/portal/commands/execute');
 x.setRequestHeader('Content-Type','application/json');
 x.onload=function(){
  el.classList.remove('run');
  if(x.status>=200&&x.status<300){
   var d=JSON.parse(x.responseText);
   el.classList.add('ok');teT(d.message||t+' gestart','ok');
   setTimeout(function(){el.classList.remove('ok')},5000);
  }else if(x.status===429){teT('Even geduld — cooldown actief','info')}
  else{var e='Fout';try{e=JSON.parse(x.responseText).detail||e}catch(er){}teT(e,'err')}
 };
 x.onerror=function(){el.classList.remove('run');teT('Geen verbinding met TinyEclipse','err')};
 x.send(JSON.stringify({tenant_id:tid,token:tok,command_type:t,payload:{}}));
}
function teT(m,t){
 var d=document.createElement('div');d.className='te-toast te-toast-'+t;d.textContent=m;
 document.body.appendChild(d);
 setTimeout(function(){d.style.opacity='0';d.style.transform='translateY(20px)';d.style.transition='all .3s'},3000);
 setTimeout(function(){d.remove()},3500);
}
</script>";

    return $o;
}


// ═══════════════════════════════════════════════════════════
// HELPER — API call to TinyEclipse Hub
// ═══════════════════════════════════════════════════════════

function _te_hooks_api($api_url, $path, $admin_key, $method = 'GET', $body = null) {
    $url = rtrim($api_url, '/') . $path;
    $ch = curl_init($url);
    $headers = ['Accept: application/json'];
    if ($admin_key) $headers[] = 'X-Admin-Key: ' . $admin_key;
    if ($body) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code >= 200 && $code < 300 && $resp) {
        return json_decode($resp, true);
    }
    return null;
}
