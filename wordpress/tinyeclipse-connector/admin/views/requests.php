<?php
if (!defined('ABSPATH')) exit;
$site_id = tinyeclipse_get_tenant_id();
?>
<div class="wrap" style="max-width:1000px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <h1 style="font-size:22px;margin-bottom:20px;">📩 Requests</h1>

    <?php if (empty($site_id)): ?>
    <div style="background:#fefce8;border:1px solid #fef08a;border-radius:12px;padding:20px;">
        <p style="margin:0;color:#713f12;">⚠️ Verbind eerst met Eclipse Hub.</p>
    </div>
    <?php else: ?>

    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:20px;">
        <h3 style="margin:0 0 12px;font-size:15px;">Nieuw verzoek indienen</h3>
        <p style="color:#6b7280;font-size:13px;margin-bottom:12px;">Dien een verzoek in bij Digital Farmers voor wijzigingen, ondersteuning of nieuwe functies.</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
            <select id="te-req-type" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;max-width:300px;">
                <option value="support">🔧 Ondersteuning</option>
                <option value="change">✏️ Wijziging</option>
                <option value="feature">💡 Nieuwe functie</option>
                <option value="bug">🐛 Bug melden</option>
            </select>
            <input id="te-req-subject" type="text" placeholder="Onderwerp..." style="padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;" />
            <textarea id="te-req-message" rows="4" placeholder="Beschrijf je verzoek..." style="padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;"></textarea>
            <button onclick="teSubmitRequest()" class="button button-primary" style="align-self:flex-start;">📩 Verzoek indienen</button>
        </div>
    </div>

    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
        <h3 style="margin:0 0 12px;font-size:15px;">Eerdere verzoeken</h3>
        <p style="color:#6b7280;font-size:13px;">Bekijk je verzoeken in Eclipse Hub.</p>
        <a href="<?php echo esc_url(TINYECLIPSE_HUB_URL); ?>" target="_blank" class="button">🌐 Open Eclipse Hub</a>
    </div>
    <?php endif; ?>
</div>
<script>
function teSubmitRequest() {
    var type = document.getElementById('te-req-type').value;
    var subject = document.getElementById('te-req-subject').value;
    var message = document.getElementById('te-req-message').value;
    if (!subject || !message) { alert('Vul onderwerp en bericht in.'); return; }
    jQuery.post(tinyeclipse.ajax_url, {
        action: 'tinyeclipse_request_submit', nonce: tinyeclipse.nonce,
        type: type, subject: subject, message: message
    }, function(r) {
        if (r.success) { alert('✅ Verzoek ingediend!'); document.getElementById('te-req-subject').value=''; document.getElementById('te-req-message').value=''; }
        else alert('❌ ' + (r.data||'Fout'));
    });
}
</script>
