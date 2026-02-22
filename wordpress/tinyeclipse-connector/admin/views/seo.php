<?php
if (!defined('ABSPATH')) exit;
$audit = TinyEclipse_SEO::instance()->audit();
$icon = $audit['score'] >= 80 ? '🟢' : ($audit['score'] >= 50 ? '🟡' : '🔴');
$color = $audit['score'] >= 80 ? '#22c55e' : ($audit['score'] >= 50 ? '#eab308' : '#ef4444');
$ring_color = $audit['score'] >= 80 ? '#22c55e' : ($audit['score'] >= 50 ? '#eab308' : '#ef4444');
$ring_pct = max(0, min(100, $audit['score']));

// Count issues
$fails = 0; $warns = 0; $passes = 0;
foreach ($audit['checks'] as $k => $c) {
    if ($k === 'meta_descriptions') continue;
    if ($c['status'] === 'pass') $passes++;
    elseif ($c['status'] === 'warn') $warns++;
    else $fails++;
}

// Count page issues
$pages_missing_meta = 0; $pages_short_content = 0; $pages_bad_title = 0;
$pages = $audit['checks']['meta_descriptions']['pages'] ?? [];
foreach ($pages as $p) {
    if (!$p['meta_ok']) $pages_missing_meta++;
    if (!$p['content_ok']) $pages_short_content++;
    if (!$p['title_ok']) $pages_bad_title++;
}
?>
<div class="wrap" style="max-width:1200px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#9333ea);display:flex;align-items:center;justify-content:center;">
                <span style="font-size:22px;">🔍</span>
            </div>
            <div>
                <h1 style="margin:0;font-size:22px;font-weight:700;">SEO Audit & Optimizer</h1>
                <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">Analyseer, optimaliseer & verbeter je SEO met AI</p>
            </div>
        </div>
        <div style="display:flex;gap:8px;">
            <button onclick="teSeoRescan()" class="button" style="border-radius:8px;">🔄 Opnieuw scannen</button>
        </div>
    </div>

    <!-- Score + Stats Row -->
    <div style="display:grid;grid-template-columns:200px 1fr;gap:16px;margin-bottom:24px;">
        <!-- Score Circle -->
        <div style="background:white;border:1px solid #e5e7eb;border-radius:16px;padding:24px;text-align:center;">
            <div style="position:relative;width:120px;height:120px;margin:0 auto;">
                <svg viewBox="0 0 120 120" style="transform:rotate(-90deg);">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#f3f4f6" stroke-width="8"/>
                    <circle cx="60" cy="60" r="52" fill="none" stroke="<?php echo $ring_color; ?>" stroke-width="8" stroke-linecap="round" stroke-dasharray="<?php echo 326.7 * $ring_pct / 100; ?> 326.7"/>
                </svg>
                <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                    <span style="font-size:32px;font-weight:800;color:<?php echo $color; ?>;"><?php echo $audit['score']; ?></span>
                    <span style="font-size:11px;color:#9ca3af;">/ 100</span>
                </div>
            </div>
            <?php if ($audit['seo_plugin']): ?>
            <div style="margin-top:12px;background:#eff6ff;color:#2563eb;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:500;display:inline-block;">🔌 <?php echo esc_html($audit['seo_plugin']); ?></div>
            <?php else: ?>
            <div style="margin-top:12px;background:#fef2f2;color:#dc2626;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:500;display:inline-block;">⚠️ Geen SEO plugin</div>
            <?php endif; ?>
        </div>

        <!-- Stats Grid -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
            <?php
            $stat_cards = [
                ['✅', 'Passed', $passes, '#22c55e', '#f0fdf4', '#bbf7d0'],
                ['⚠️', 'Waarschuwingen', $warns, '#eab308', '#fefce8', '#fef08a'],
                ['❌', 'Fouten', $fails, '#ef4444', '#fef2f2', '#fecaca'],
                ['📄', 'Pagina\'s zonder meta', $pages_missing_meta, '#f59e0b', '#fffbeb', '#fed7aa'],
                ['📝', 'Te weinig content', $pages_short_content, '#8b5cf6', '#f5f3ff', '#ddd6fe'],
                ['🏷️', 'Slechte titels', $pages_bad_title, '#06b6d4', '#ecfeff', '#a5f3fc'],
            ];
            foreach ($stat_cards as $sc): ?>
            <div style="background:<?php echo $sc[4]; ?>;border:1px solid <?php echo $sc[5]; ?>;border-radius:10px;padding:14px;">
                <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;"><?php echo $sc[0] . ' ' . $sc[1]; ?></div>
                <div style="font-size:28px;font-weight:700;color:<?php echo $sc[3]; ?>;margin-top:2px;"><?php echo $sc[2]; ?></div>
            </div>
            <?php endforeach; ?>
        </div>
    </div>

    <!-- Checks List -->
    <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;">🔎 SEO Checks</h2>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:24px;">
        <?php foreach ($audit['checks'] as $key => $check):
            if ($key === 'meta_descriptions') continue;
            $s = $check['status'] === 'pass' ? '✅' : ($check['status'] === 'warn' ? '⚠️' : '❌');
            $bg = $check['status'] === 'pass' ? '#f0fdf4' : ($check['status'] === 'warn' ? '#fefce8' : '#fef2f2');
            $bd = $check['status'] === 'pass' ? '#bbf7d0' : ($check['status'] === 'warn' ? '#fef08a' : '#fecaca');
        ?>
        <div style="background:<?php echo $bg; ?>;border:1px solid <?php echo $bd; ?>;border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;">
            <div>
                <div style="font-size:13px;font-weight:600;color:#111827;"><?php echo $s; ?> <?php echo esc_html($check['label']); ?></div>
                <div style="font-size:11px;color:#6b7280;margin-top:1px;"><?php echo esc_html($check['detail']); ?></div>
            </div>
            <?php if (!empty($check['fix'])): ?>
            <span style="font-size:10px;color:#6366f1;background:#eff6ff;padding:2px 8px;border-radius:12px;white-space:nowrap;">💡 Fix beschikbaar</span>
            <?php endif; ?>
        </div>
        <?php endforeach; ?>
    </div>

    <!-- Page SEO Audit Table -->
    <?php if (!empty($pages)): ?>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h2 style="font-size:16px;font-weight:600;margin:0;">📄 Pagina SEO Audit (<?php echo count($pages); ?> pagina's)</h2>
        <div style="display:flex;gap:6px;">
            <input type="text" id="te-seo-search" placeholder="🔍 Zoek pagina..." oninput="teSeoFilter()" style="padding:6px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;width:200px;">
            <select id="te-seo-filter" onchange="teSeoFilter()" style="padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;">
                <option value="">Alles</option>
                <option value="issues">⚠️ Met problemen</option>
                <option value="ok">✅ OK</option>
            </select>
        </div>
    </div>
    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;" id="te-seo-table">
            <thead>
                <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
                    <th style="padding:10px 12px;text-align:left;">Pagina</th>
                    <th style="padding:10px 12px;text-align:left;">Type</th>
                    <th style="padding:10px 12px;text-align:center;">🏷️ Titel</th>
                    <th style="padding:10px 12px;text-align:center;">📝 Meta</th>
                    <th style="padding:10px 12px;text-align:center;">📄 Content</th>
                    <th style="padding:10px 12px;text-align:center;">Score</th>
                    <th style="padding:10px 12px;text-align:right;">Acties</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($pages as $p):
                $page_score = 0;
                if ($p['title_ok']) $page_score += 33;
                if ($p['meta_ok']) $page_score += 34;
                if ($p['content_ok']) $page_score += 33;
                $has_issues = !$p['title_ok'] || !$p['meta_ok'] || !$p['content_ok'];
                $score_color = $page_score >= 80 ? '#22c55e' : ($page_score >= 50 ? '#eab308' : '#ef4444');
            ?>
            <tr class="te-seo-row" data-issues="<?php echo $has_issues ? '1' : '0'; ?>" data-title="<?php echo esc_attr(strtolower($p['title'])); ?>" style="border-bottom:1px solid #f3f4f6;transition:background 0.15s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
                <td style="padding:10px 12px;">
                    <a href="<?php echo esc_url($p['url']); ?>" style="font-weight:600;color:#111827;text-decoration:none;font-size:13px;" onmouseover="this.style.color='#6366f1'" onmouseout="this.style.color='#111827'"><?php echo esc_html($p['title']); ?></a>
                </td>
                <td style="padding:10px 12px;"><span style="background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:500;"><?php echo esc_html($p['type']); ?></span></td>
                <td style="padding:10px 12px;text-align:center;">
                    <span title="<?php echo $p['title_length']; ?> tekens"><?php echo $p['title_ok'] ? '✅' : '⚠️'; ?></span>
                    <span style="font-size:10px;color:#9ca3af;margin-left:2px;"><?php echo $p['title_length']; ?></span>
                </td>
                <td style="padding:10px 12px;text-align:center;">
                    <span title="<?php echo $p['meta_length']; ?> tekens"><?php echo $p['meta_ok'] ? '✅' : ($p['meta_length'] > 0 ? '⚠️' : '❌'); ?></span>
                    <span style="font-size:10px;color:#9ca3af;margin-left:2px;"><?php echo $p['meta_length']; ?></span>
                </td>
                <td style="padding:10px 12px;text-align:center;">
                    <span title="<?php echo number_format($p['word_count']); ?> woorden"><?php echo $p['content_ok'] ? '✅' : '⚠️'; ?></span>
                    <span style="font-size:10px;color:#9ca3af;margin-left:2px;"><?php echo number_format($p['word_count']); ?>w</span>
                </td>
                <td style="padding:10px 12px;text-align:center;">
                    <span style="font-weight:700;color:<?php echo $score_color; ?>;font-size:13px;"><?php echo $page_score; ?>%</span>
                </td>
                <td style="padding:10px 12px;text-align:right;">
                    <a href="<?php echo esc_url($p['url']); ?>" class="button button-small" style="border-radius:6px;font-size:11px;">✏️ Edit</a>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>

    <p style="text-align:center;margin-top:24px;color:#9ca3af;font-size:11px;">
        Laatste scan: <?php echo date('d/m/Y H:i'); ?> · TinyEclipse SEO v<?php echo TINYECLIPSE_VERSION; ?>
    </p>
</div>

<script>
function teSeoFilter() {
    var search = document.getElementById('te-seo-search').value.toLowerCase();
    var filter = document.getElementById('te-seo-filter').value;
    document.querySelectorAll('.te-seo-row').forEach(function(row) {
        var title = row.dataset.title || '';
        var issues = row.dataset.issues;
        var show = true;
        if (search && title.indexOf(search) === -1) show = false;
        if (filter === 'issues' && issues !== '1') show = false;
        if (filter === 'ok' && issues !== '0') show = false;
        row.style.display = show ? '' : 'none';
    });
}
function teSeoRescan() {
    location.reload();
}
</script>
