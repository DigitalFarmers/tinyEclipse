<?php
if (!defined('ABSPATH')) exit;
$site_id = tinyeclipse_get_tenant_id();
?>
<div class="wrap" style="max-width:1000px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <h1 style="font-size:22px;margin-bottom:20px;">📬 Leads</h1>

    <?php if (empty($site_id)): ?>
    <div style="background:#fefce8;border:1px solid #fef08a;border-radius:12px;padding:20px;">
        <p style="margin:0;color:#713f12;">⚠️ Verbind eerst met Eclipse Hub om leads te beheren.</p>
    </div>
    <?php else: ?>
    <div id="te-leads-container" style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
        <p style="color:#6b7280;">Leads worden beheerd via Eclipse Hub.</p>
        <a href="<?php echo esc_url(TINYECLIPSE_HUB_URL . '/admin/leads'); ?>" target="_blank" class="button button-primary">🌐 Open Leads in Eclipse Hub</a>
    </div>

    <div style="margin-top:20px;background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
        <h3 style="margin:0 0 12px;font-size:15px;">Widget Lead Capture</h3>
        <p style="color:#6b7280;font-size:13px;">Leads worden automatisch vastgelegd wanneer bezoekers hun contactgegevens achterlaten via de chat widget. Deze worden gesynchroniseerd naar Eclipse Hub en gekoppeld aan unified contact profielen.</p>
        <div style="display:flex;gap:8px;margin-top:12px;">
            <span style="background:#f0fdf4;color:#16a34a;padding:4px 12px;border-radius:20px;font-size:12px;">✅ Widget actief</span>
            <span style="background:#eff6ff;color:#2563eb;padding:4px 12px;border-radius:20px;font-size:12px;">🔄 Auto-sync</span>
        </div>
    </div>
    <?php endif; ?>
</div>
