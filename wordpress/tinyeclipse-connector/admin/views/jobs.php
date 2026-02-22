<?php
if (!defined('ABSPATH')) exit;
$audit = TinyEclipse_Jobs::instance()->audit();

// Get job types/categories for filters
$job_types = get_terms(['taxonomy' => 'job_listing_type', 'hide_empty' => false]);
$job_categories = get_terms(['taxonomy' => 'job_listing_category', 'hide_empty' => false]);
if (is_wp_error($job_types)) $job_types = [];
if (is_wp_error($job_categories)) $job_categories = [];

// Get all jobs with full data for inline editing
$all_jobs = [];
if ($audit['active']) {
    $job_query = new WP_Query([
        'post_type' => 'job_listing',
        'posts_per_page' => -1,
        'post_status' => ['publish', 'expired', 'draft', 'pending', 'preview'],
        'orderby' => 'date',
        'order' => 'DESC'
    ]);
    while ($job_query->have_posts()) {
        $job_query->the_post();
        $id = get_the_ID();
        $all_jobs[] = [
            'id' => $id,
            'title' => get_the_title(),
            'status' => get_post_status(),
            'company' => get_post_meta($id, '_company_name', true),
            'location' => get_post_meta($id, '_job_location', true),
            'type' => wp_get_post_terms($id, 'job_listing_type', ['fields' => 'names']),
            'category' => wp_get_post_terms($id, 'job_listing_category', ['fields' => 'names']),
            'salary' => get_post_meta($id, '_job_salary', true) ?: get_post_meta($id, '_salary', true),
            'deadline' => get_post_meta($id, '_job_expires', true) ?: get_post_meta($id, '_application_deadline', true),
            'applications' => (int) get_post_meta($id, '_job_application_count', true),
            'featured' => (bool) get_post_meta($id, '_featured', true),
            'url' => get_edit_post_link($id),
            'view_url' => get_permalink($id),
            'date' => get_the_date('d/m/Y'),
            'excerpt' => wp_trim_words(get_the_content(), 20),
        ];
    }
    wp_reset_postdata();
}
?>
<div class="wrap" style="max-width:1200px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#9333ea);display:flex;align-items:center;justify-content:center;">
                <span style="font-size:22px;">💼</span>
            </div>
            <div>
                <h1 style="margin:0;font-size:22px;font-weight:700;">Jobs & Recruitment</h1>
                <p style="margin:2px 0 0;color:#6b7280;font-size:13px;">Beheer vacatures, sollicitaties & AI-generatie</p>
            </div>
        </div>
        <div style="display:flex;gap:8px;">
            <a href="<?php echo admin_url('post-new.php?post_type=job_listing'); ?>" class="button button-primary" style="display:flex;align-items:center;gap:6px;border-radius:8px;">➕ Nieuwe vacature</a>
            <button onclick="teJobsBulkAction('publish_all_draft')" class="button" style="border-radius:8px;">▶️ Alle concepten publiceren</button>
        </div>
    </div>

    <?php if (!$audit['active']): ?>
    <div style="background:#fefce8;border:1px solid #fef08a;border-radius:12px;padding:24px;text-align:center;">
        <span style="font-size:40px;">💼</span>
        <h3 style="margin:12px 0 4px;">WP Job Manager niet geïnstalleerd</h3>
        <p style="color:#713f12;margin:0;">Installeer <a href="<?php echo admin_url('plugin-install.php?s=wp+job+manager&tab=search'); ?>">WP Job Manager</a> om vacatures te beheren.</p>
    </div>
    <?php else: ?>

    <!-- Stats Row -->
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:20px;">
        <?php
        $stat_items = [
            ['🟢', 'Actief', $audit['active_jobs'], '#22c55e'],
            ['🔴', 'Verlopen', $audit['expired_jobs'], '#ef4444'],
            ['📝', 'Concept', $audit['draft_jobs'], '#9ca3af'],
            ['📨', 'Sollicitaties', $audit['total_applications'], '#6366f1'],
            ['📂', 'Categorieën', count($job_categories), '#f59e0b'],
            ['🏷️', 'Types', count($job_types), '#06b6d4'],
        ];
        foreach ($stat_items as $s): ?>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;"><?php echo $s[0] . ' ' . $s[1]; ?></div>
            <div style="font-size:24px;font-weight:700;color:<?php echo $s[3]; ?>;margin-top:2px;"><?php echo $s[2]; ?></div>
        </div>
        <?php endforeach; ?>
    </div>

    <!-- Filter Bar -->
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
        <input type="text" id="te-job-search" placeholder="🔍 Zoek vacature..." oninput="teFilterJobs()" style="padding:8px 14px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;width:240px;">
        <select id="te-job-status-filter" onchange="teFilterJobs()" style="padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;">
            <option value="">Alle statussen</option>
            <option value="publish">🟢 Actief</option>
            <option value="expired">🔴 Verlopen</option>
            <option value="draft">📝 Concept</option>
        </select>
        <?php if (!empty($job_categories) && !is_wp_error($job_categories)): ?>
        <select id="te-job-cat-filter" onchange="teFilterJobs()" style="padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;">
            <option value="">Alle categorieën</option>
            <?php foreach ($job_categories as $cat): ?>
            <option value="<?php echo esc_attr($cat->name); ?>"><?php echo esc_html($cat->name); ?></option>
            <?php endforeach; ?>
        </select>
        <?php endif; ?>
        <div style="margin-left:auto;display:flex;gap:6px;">
            <button onclick="teSelectAllJobs()" class="button button-small" style="border-radius:6px;">☑️ Selecteer alles</button>
            <button onclick="teJobsBulkAction('delete_expired')" class="button button-small" style="border-radius:6px;color:#ef4444;">🗑️ Verlopen verwijderen</button>
        </div>
    </div>

    <!-- Jobs Table -->
    <?php if (!empty($all_jobs)): ?>
    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;" id="te-jobs-table">
            <thead>
                <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
                    <th style="padding:10px 12px;text-align:left;width:30px;"><input type="checkbox" id="te-job-select-all" onchange="teToggleAllJobs(this)"></th>
                    <th style="padding:10px 12px;text-align:left;">Vacature</th>
                    <th style="padding:10px 12px;text-align:left;">Bedrijf</th>
                    <th style="padding:10px 12px;text-align:left;">Locatie</th>
                    <th style="padding:10px 12px;text-align:left;">Type</th>
                    <th style="padding:10px 12px;text-align:center;">Status</th>
                    <th style="padding:10px 12px;text-align:center;">📨</th>
                    <th style="padding:10px 12px;text-align:center;">Deadline</th>
                    <th style="padding:10px 12px;text-align:right;">Acties</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($all_jobs as $job):
                $status_map = [
                    'publish' => ['🟢', 'Actief', '#dcfce7', '#16a34a'],
                    'expired' => ['🔴', 'Verlopen', '#fef2f2', '#dc2626'],
                    'draft'   => ['📝', 'Concept', '#f3f4f6', '#6b7280'],
                    'pending' => ['⏳', 'Wachtend', '#fefce8', '#ca8a04'],
                    'preview' => ['👁️', 'Preview', '#f3f4f6', '#6b7280'],
                ];
                $st = $status_map[$job['status']] ?? ['❓', $job['status'], '#f3f4f6', '#6b7280'];
                $cats = implode(', ', $job['category'] ?: []);
                $types = implode(', ', $job['type'] ?: []);
                $is_expired = $job['deadline'] && strtotime($job['deadline']) < time();
            ?>
            <tr class="te-job-row" data-status="<?php echo esc_attr($job['status']); ?>" data-category="<?php echo esc_attr($cats); ?>" data-title="<?php echo esc_attr(strtolower($job['title'])); ?>" style="border-bottom:1px solid #f3f4f6;transition:background 0.15s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
                <td style="padding:10px 12px;"><input type="checkbox" class="te-job-cb" value="<?php echo $job['id']; ?>"></td>
                <td style="padding:10px 12px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <?php if ($job['featured']): ?><span title="Featured" style="color:#f59e0b;">⭐</span><?php endif; ?>
                        <div>
                            <a href="<?php echo esc_url($job['url']); ?>" style="font-weight:600;color:#111827;text-decoration:none;" onmouseover="this.style.color='#6366f1'" onmouseout="this.style.color='#111827'"><?php echo esc_html($job['title']); ?></a>
                            <div style="font-size:11px;color:#9ca3af;margin-top:1px;"><?php echo esc_html(wp_trim_words($job['excerpt'], 10)); ?></div>
                        </div>
                    </div>
                </td>
                <td style="padding:10px 12px;color:#374151;"><?php echo esc_html($job['company']); ?></td>
                <td style="padding:10px 12px;color:#6b7280;font-size:12px;">📍 <?php echo esc_html($job['location'] ?: '—'); ?></td>
                <td style="padding:10px 12px;"><span style="background:#eff6ff;color:#2563eb;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500;"><?php echo esc_html($types ?: '—'); ?></span></td>
                <td style="padding:10px 12px;text-align:center;"><span style="background:<?php echo $st[2]; ?>;color:<?php echo $st[3]; ?>;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;"><?php echo $st[0] . ' ' . $st[1]; ?></span></td>
                <td style="padding:10px 12px;text-align:center;font-weight:600;color:#6366f1;"><?php echo $job['applications']; ?></td>
                <td style="padding:10px 12px;text-align:center;font-size:12px;color:<?php echo $is_expired ? '#ef4444' : '#6b7280'; ?>;"><?php echo $job['deadline'] ? date('d/m/Y', strtotime($job['deadline'])) : '—'; ?></td>
                <td style="padding:10px 12px;text-align:right;">
                    <div style="display:flex;gap:4px;justify-content:flex-end;">
                        <?php if ($job['status'] === 'publish'): ?>
                        <button onclick="teJobToggle(<?php echo $job['id']; ?>,'close')" title="Sluiten" style="border:1px solid #e5e7eb;background:white;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'">⏸️</button>
                        <?php else: ?>
                        <button onclick="teJobToggle(<?php echo $job['id']; ?>,'publish')" title="Publiceren" style="border:1px solid #e5e7eb;background:white;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;" onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='white'">▶️</button>
                        <?php endif; ?>
                        <button onclick="teJobDuplicate(<?php echo $job['id']; ?>)" title="Dupliceren" style="border:1px solid #e5e7eb;background:white;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='white'">📋</button>
                        <a href="<?php echo esc_url($job['view_url']); ?>" target="_blank" title="Bekijken" style="border:1px solid #e5e7eb;background:white;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;text-decoration:none;display:inline-block;" onmouseover="this.style.background='#f5f3ff'" onmouseout="this.style.background='white'">�️</a>
                        <a href="<?php echo esc_url($job['url']); ?>" title="Bewerken" style="border:1px solid #e5e7eb;background:white;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;text-decoration:none;display:inline-block;" onmouseover="this.style.background='#fefce8'" onmouseout="this.style.background='white'">✏️</a>
                    </div>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <p style="color:#9ca3af;font-size:12px;margin-top:8px;"><?php echo count($all_jobs); ?> vacatures totaal · Laatste update: <?php echo tinyeclipse_format_datetime(); ?></p>
    <?php else: ?>
    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:40px;text-align:center;">
        <span style="font-size:48px;">💼</span>
        <h3 style="margin:12px 0 4px;">Nog geen vacatures</h3>
        <p style="color:#6b7280;">Maak je eerste vacature aan via de knop hierboven.</p>
    </div>
    <?php endif; ?>
    <?php endif; ?>
</div>

<script>
function teFilterJobs() {
    var search = document.getElementById('te-job-search').value.toLowerCase();
    var status = document.getElementById('te-job-status-filter').value;
    var catEl = document.getElementById('te-job-cat-filter');
    var cat = catEl ? catEl.value.toLowerCase() : '';
    document.querySelectorAll('.te-job-row').forEach(function(row) {
        var title = row.dataset.title || '';
        var rowStatus = row.dataset.status || '';
        var rowCat = (row.dataset.category || '').toLowerCase();
        var show = true;
        if (search && title.indexOf(search) === -1) show = false;
        if (status && rowStatus !== status) show = false;
        if (cat && rowCat.indexOf(cat) === -1) show = false;
        row.style.display = show ? '' : 'none';
    });
}
function teToggleAllJobs(el) {
    document.querySelectorAll('.te-job-cb').forEach(function(cb) {
        var row = cb.closest('.te-job-row');
        if (row && row.style.display !== 'none') cb.checked = el.checked;
    });
}
function teSelectAllJobs() {
    document.querySelectorAll('.te-job-cb').forEach(function(cb) { cb.checked = true; });
}
function teGetSelectedIds() {
    var ids = [];
    document.querySelectorAll('.te-job-cb:checked').forEach(function(cb) { ids.push(cb.value); });
    return ids;
}
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
function teJobsBulkAction(action) {
    var ids = teGetSelectedIds();
    if (action === 'delete_expired') {
        if (!confirm('Alle verlopen vacatures verwijderen?')) return;
    }
    jQuery.post(tinyeclipse.ajax_url, {action:'tinyeclipse_jobs_bulk',nonce:tinyeclipse.nonce,bulk_action:action,job_ids:ids}, function(r) {
        if (r.success) location.reload(); else alert('❌ ' + (r.data||'Fout'));
    });
}
</script>
