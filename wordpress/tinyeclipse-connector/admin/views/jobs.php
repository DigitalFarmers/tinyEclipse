<?php
if (!defined('ABSPATH')) exit;
$audit = TinyEclipse_Jobs::instance()->audit();
?>
<div class="wrap" style="max-width:900px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <h1 style="font-size:22px;margin-bottom:20px;">💼 Jobs & Recruitment</h1>

    <?php if (!$audit['active']): ?>
    <div style="background:#fefce8;border:1px solid #fef08a;border-radius:12px;padding:20px;">
        <p style="margin:0;color:#713f12;">⚠️ WP Job Manager is niet geïnstalleerd.</p>
    </div>
    <?php else: ?>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Actief</div>
            <div style="font-size:28px;font-weight:700;color:#22c55e;"><?php echo $audit['active_jobs']; ?></div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Verlopen</div>
            <div style="font-size:28px;font-weight:700;color:#ef4444;"><?php echo $audit['expired_jobs']; ?></div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Concept</div>
            <div style="font-size:28px;font-weight:700;color:#9ca3af;"><?php echo $audit['draft_jobs']; ?></div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Sollicitaties</div>
            <div style="font-size:28px;font-weight:700;color:#6366f1;"><?php echo $audit['total_applications']; ?></div>
        </div>
    </div>

    <?php if (!empty($audit['jobs'])): ?>
    <table class="widefat striped" style="border-radius:10px;overflow:hidden;">
        <thead><tr><th>Vacature</th><th>Bedrijf</th><th>Locatie</th><th>Status</th><th>Sollicitaties</th><th>Acties</th></tr></thead>
        <tbody>
        <?php foreach ($audit['jobs'] as $job):
            $s_color = $job['status'] === 'publish' ? '#22c55e' : ($job['status'] === 'expired' ? '#ef4444' : '#9ca3af');
        ?>
        <tr>
            <td><a href="<?php echo esc_url($job['url']); ?>" target="_blank"><?php echo esc_html($job['title']); ?></a></td>
            <td><?php echo esc_html($job['company']); ?></td>
            <td><?php echo esc_html($job['location']); ?></td>
            <td><span style="color:<?php echo $s_color; ?>;font-weight:500;"><?php echo esc_html($job['status']); ?></span></td>
            <td><?php echo $job['applications']; ?></td>
            <td>
                <button onclick="teJobToggle(<?php echo $job['id']; ?>,'<?php echo $job['status'] === 'publish' ? 'close' : 'publish'; ?>')" class="button button-small"><?php echo $job['status'] === 'publish' ? '⏸️' : '▶️'; ?></button>
                <button onclick="teJobDuplicate(<?php echo $job['id']; ?>)" class="button button-small">📋</button>
            </td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>
    <?php endif; ?>
</div>
<script>
function teJobToggle(id, action) {
    jQuery.post(tinyeclipse.ajax_url, {action:'tinyeclipse_job_toggle',nonce:tinyeclipse.nonce,job_id:id,toggle_action:action}, function(r) {
        if (r.success) location.reload(); else alert('❌ ' + (r.data||'Fout'));
    });
}
function teJobDuplicate(id) {
    jQuery.post(tinyeclipse.ajax_url, {action:'tinyeclipse_job_duplicate',nonce:tinyeclipse.nonce,job_id:id}, function(r) {
        if (r.success) location.reload(); else alert('❌ ' + (r.data||'Fout'));
    });
}
</script>
