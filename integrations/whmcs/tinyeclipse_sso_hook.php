<?php
/**
 * TinyEclipse SSO Hook for WHMCS
 * 
 * Place this file in: /path/to/whmcs/includes/hooks/tinyeclipse_sso_hook.php
 * 
 * Adds a "TinyEclipse Dashboard" button to the client area sidebar.
 * When clicked, the client is auto-logged into their TinyEclipse portal
 * via a signed SSO link (HMAC-SHA256, 5 min expiry).
 * 
 * Requirements:
 * - TinyEclipse backend running with portal_auth router
 * - APP_SECRET_KEY must match between WHMCS hook and TinyEclipse backend
 */

if (!defined("WHMCS")) die("This file cannot be accessed directly");

// ─── Configuration ───
define('TINYECLIPSE_API', 'https://api.tinyeclipse.digitalfarmers.be');
define('TINYECLIPSE_PORTAL', 'https://tinyeclipse.digitalfarmers.be/portal');
define('TINYECLIPSE_SECRET', 'te-secret-xK9mP2vL8nQ4wR7j'); // Must match APP_SECRET_KEY in backend

/**
 * Generate a signed SSO URL for a WHMCS client.
 */
function tinyeclipse_generate_sso_url($client_id, $tenant_id) {
    $ts = time();
    $msg = $tenant_id . ':' . $ts;
    $sig = hash_hmac('sha256', $msg, TINYECLIPSE_SECRET);
    
    return TINYECLIPSE_PORTAL . '?sso=' . $tenant_id . ':' . $ts . ':' . $sig;
}

/**
 * Get the tenant_id for a WHMCS client.
 * Looks up the tenant by whmcs_client_id via the TinyEclipse API.
 */
function tinyeclipse_get_tenant_id($client_id) {
    // Cache in session to avoid repeated API calls
    $cache_key = 'tinyeclipse_tenant_' . $client_id;
    if (isset($_SESSION[$cache_key])) {
        return $_SESSION[$cache_key];
    }
    
    $url = TINYECLIPSE_API . '/api/portal/sso/generate?client_id=' . intval($client_id);
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($code === 200) {
        $data = json_decode($response, true);
        if (!empty($data['tenant_id'])) {
            $_SESSION[$cache_key] = $data['tenant_id'];
            return $data['tenant_id'];
        }
    }
    
    return null;
}

/**
 * Hook: Add TinyEclipse Dashboard link to Client Area Sidebar
 */
add_hook('ClientAreaPrimarySidebar', 1, function($sidebar) {
    if (!isset($_SESSION['uid'])) return;
    
    $client_id = $_SESSION['uid'];
    $tenant_id = tinyeclipse_get_tenant_id($client_id);
    
    if (!$tenant_id) return; // No TinyEclipse account for this client
    
    $sso_url = tinyeclipse_generate_sso_url($client_id, $tenant_id);
    
    // Add to existing "My Account" panel or create new one
    $panel = $sidebar->getChild('My Account');
    if (!$panel) {
        $panel = $sidebar->addChild('My Account');
    }
    
    $panel->addChild('TinyEclipse Dashboard', [
        'label' => '⚡ Website Dashboard',
        'uri' => $sso_url,
        'order' => 1,
        'icon' => 'fa-bolt',
        'attributes' => [
            'target' => '_blank',
        ],
    ]);
});

/**
 * Hook: Add TinyEclipse link to Client Area Homepage
 */
add_hook('ClientAreaPage', 1, function($vars) {
    if (!isset($_SESSION['uid'])) return [];
    
    $client_id = $_SESSION['uid'];
    $tenant_id = tinyeclipse_get_tenant_id($client_id);
    
    if (!$tenant_id) return [];
    
    $sso_url = tinyeclipse_generate_sso_url($client_id, $tenant_id);
    
    return [
        'tinyeclipse_sso_url' => $sso_url,
        'tinyeclipse_tenant_id' => $tenant_id,
    ];
});
