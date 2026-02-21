<?php
if (!defined('ABSPATH')) exit;
$audit = TinyEclipse_Translation::instance()->audit();
$translator = TinyEclipse_Translator::instance();
?>
<div class="wrap" style="max-width:900px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <h1 style="font-size:22px;margin-bottom:20px;">🌐 Translation</h1>

    <?php if (!$audit['active']): ?>
    <div style="background:#fefce8;border:1px solid #fef08a;border-radius:12px;padding:20px;">
        <h3 style="margin:0 0 8px;">⚠️ WPML niet geïnstalleerd</h3>
        <p style="margin:0;color:#713f12;">Installeer WPML om vertalingen te beheren via TinyEclipse.</p>
    </div>
    <?php else: ?>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:24px;">
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Dekking</div>
            <div style="font-size:32px;font-weight:700;color:#6366f1;"><?php echo $audit['overall_coverage']; ?>%</div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Talen</div>
            <div style="font-size:32px;font-weight:700;color:#111827;"><?php echo $audit['language_count']; ?></div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Ontbrekend</div>
            <div style="font-size:32px;font-weight:700;color:#ef4444;"><?php echo $audit['missing_count']; ?></div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Incompleet</div>
            <div style="font-size:32px;font-weight:700;color:#eab308;"><?php echo $audit['incomplete_count']; ?></div>
        </div>
    </div>

    <?php if (!empty($audit['coverage'])): ?>
    <h2 style="font-size:16px;margin-bottom:12px;">Taal Dekking</h2>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px;">
        <?php foreach ($audit['coverage'] as $lang => $c): ?>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-weight:600;font-size:14px;"><?php echo strtoupper($lang); ?></span>
                <span style="font-size:13px;color:#6b7280;"><?php echo $c['translated']; ?>/<?php echo $c['total']; ?> (<?php echo $c['percentage']; ?>%)</span>
            </div>
            <div style="background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden;">
                <div style="background:<?php echo $c['percentage'] >= 80 ? '#22c55e' : ($c['percentage'] >= 50 ? '#eab308' : '#ef4444'); ?>;height:100%;width:<?php echo $c['percentage']; ?>%;border-radius:4px;"></div>
            </div>
            <?php if ($c['missing'] > 0): ?>
            <div style="font-size:11px;color:#ef4444;margin-top:4px;">❌ <?php echo $c['missing']; ?> ontbrekend</div>
            <?php endif; ?>
        </div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <?php if (!empty($audit['missing'])): ?>
    <h2 style="font-size:16px;margin-bottom:12px;">Ontbrekende Vertalingen (top 20)</h2>
    <table class="widefat striped" style="border-radius:10px;overflow:hidden;">
        <thead><tr><th>Pagina</th><th>Type</th><th>Taal</th><th>Actie</th></tr></thead>
        <tbody>
        <?php foreach (array_slice($audit['missing'], 0, 20) as $m): ?>
        <tr>
            <td><?php echo esc_html($m['title']); ?></td>
            <td><?php echo esc_html($m['type']); ?></td>
            <td><strong><?php echo strtoupper($m['language']); ?></strong></td>
            <td>
                <?php if ($translator->is_configured()): ?>
                <button onclick="teTranslate(<?php echo $m['page_id']; ?>,'<?php echo esc_js($m['language']); ?>')" class="button button-small">🤖 AI Vertalen</button>
                <?php else: ?>
                <span style="color:#9ca3af;font-size:11px;">AI niet geconfigureerd</span>
                <?php endif; ?>
            </td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>

    <?php endif; ?>
</div>
<script>
function teTranslate(postId, lang) {
    if (!confirm('Vertalen naar ' + lang.toUpperCase() + '?')) return;
    jQuery.post(tinyeclipse.ajax_url, {action:'tinyeclipse_translate',nonce:tinyeclipse.nonce,post_id:postId,language:lang}, function(r) {
        if (r.success) alert('✅ Vertaald! Controleer de draft in WPML.');
        else alert('❌ ' + (r.data||'Fout'));
    });
}
</script>
