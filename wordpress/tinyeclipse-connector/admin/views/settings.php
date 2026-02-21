<?php
if (!defined('ABSPATH')) exit;

$site_id = tinyeclipse_get_tenant_id();
$connected = !empty($site_id);
$connection_status = $connected ? 'connected' : 'disconnected';
?>
<div class="wrap" style="max-width:800px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#9333ea);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        <div>
            <h1 style="margin:0;font-size:22px;">TinyEclipse Settings</h1>
            <p style="margin:0;color:#666;font-size:13px;">Configuratie & verbinding</p>
        </div>
    </div>

    <?php if ($connected): ?>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:8px;">
        <span style="color:#16a34a;font-size:18px;">●</span>
        <span style="color:#166534;font-size:13px;font-weight:500;">Connected — TinyEclipse is actief</span>
    </div>
    <?php elseif ($site_id): ?>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:8px;">
        <span style="color:#dc2626;font-size:18px;">●</span>
        <span style="color:#991b1b;font-size:13px;font-weight:500;">Verbinding mislukt — controleer je instellingen</span>
    </div>
    <?php endif; ?>

    <form method="post" action="options.php">
        <?php settings_fields('tinyeclipse_settings'); ?>

        <!-- Connection -->
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:16px;">
            <h2 style="margin:0 0 16px;font-size:16px;">🔌 Verbinding</h2>
            <table class="form-table" style="margin:0;">
                <tr>
                    <th scope="row"><label for="tinyeclipse_site_id">Site ID / Tenant ID</label></th>
                    <td>
                        <input type="text" id="tinyeclipse_site_id" name="tinyeclipse_site_id"
                            value="<?php echo esc_attr(get_option('tinyeclipse_site_id', get_option('tinyeclipse_tenant_id', ''))); ?>"
                            class="regular-text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style="font-family:monospace;" />
                        <p class="description">Je vindt dit in het <a href="<?php echo esc_url(TINYECLIPSE_HUB_URL); ?>" target="_blank">Eclipse HUB</a>.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="tinyeclipse_hub_api_key">Hub API Key</label></th>
                    <td>
                        <input type="password" id="tinyeclipse_hub_api_key" name="tinyeclipse_hub_api_key"
                            value="<?php echo esc_attr(get_option('tinyeclipse_hub_api_key', '')); ?>"
                            class="regular-text" style="font-family:monospace;" />
                        <p class="description">Optioneel — voor beveiligde Hub communicatie.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Widget</th>
                    <td>
                        <label><input type="checkbox" name="tinyeclipse_enabled" value="1" <?php checked(get_option('tinyeclipse_enabled', false)); ?> /> Widget & tracking inschakelen</label>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Appearance -->
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:16px;">
            <h2 style="margin:0 0 16px;font-size:16px;">🎨 Uiterlijk</h2>
            <table class="form-table" style="margin:0;">
                <tr>
                    <th scope="row"><label for="tinyeclipse_name">Naam in chat</label></th>
                    <td><input type="text" id="tinyeclipse_name" name="tinyeclipse_name" value="<?php echo esc_attr(get_option('tinyeclipse_name', get_bloginfo('name') . ' AI')); ?>" class="regular-text" /></td>
                </tr>
                <tr>
                    <th scope="row"><label for="tinyeclipse_color">Themakleur</label></th>
                    <td>
                        <input type="color" id="tinyeclipse_color" name="tinyeclipse_color" value="<?php echo esc_attr(get_option('tinyeclipse_color', '#6C3CE1')); ?>" style="width:60px;height:36px;padding:2px;cursor:pointer;" />
                        <code style="margin-left:8px;"><?php echo esc_html(get_option('tinyeclipse_color', '#6C3CE1')); ?></code>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="tinyeclipse_lang">Taal</label></th>
                    <td>
                        <select id="tinyeclipse_lang" name="tinyeclipse_lang">
                            <?php $lang = get_option('tinyeclipse_lang', 'nl'); ?>
                            <option value="nl" <?php selected($lang, 'nl'); ?>>Nederlands</option>
                            <option value="en" <?php selected($lang, 'en'); ?>>English</option>
                            <option value="fr" <?php selected($lang, 'fr'); ?>>Français</option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="tinyeclipse_position">Positie</label></th>
                    <td>
                        <select id="tinyeclipse_position" name="tinyeclipse_position">
                            <?php $pos = get_option('tinyeclipse_position', 'bottom-right'); ?>
                            <option value="bottom-right" <?php selected($pos, 'bottom-right'); ?>>Rechtsonder</option>
                            <option value="bottom-left" <?php selected($pos, 'bottom-left'); ?>>Linksonder</option>
                        </select>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Advanced -->
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:16px;">
            <h2 style="margin:0 0 16px;font-size:16px;">⚙️ Geavanceerd</h2>
            <table class="form-table" style="margin:0;">
                <tr>
                    <th scope="row"><label for="tinyeclipse_exclude_pages">Uitsluiten op pagina's</label></th>
                    <td>
                        <textarea id="tinyeclipse_exclude_pages" name="tinyeclipse_exclude_pages" rows="3" class="large-text" placeholder="/wp-admin&#10;/checkout&#10;/bedankt"><?php echo esc_textarea(get_option('tinyeclipse_exclude_pages', '')); ?></textarea>
                        <p class="description">Eén pad per regel.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Verbergen voor rollen</th>
                    <td>
                        <?php $exclude_roles = get_option('tinyeclipse_exclude_roles', ['administrator']); foreach (wp_roles()->get_names() as $rk => $rn): ?>
                        <label style="display:block;margin-bottom:4px;"><input type="checkbox" name="tinyeclipse_exclude_roles[]" value="<?php echo esc_attr($rk); ?>" <?php checked(in_array($rk, (array)$exclude_roles)); ?> /> <?php echo esc_html($rn); ?></label>
                        <?php endforeach; ?>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="tinyeclipse_report_email">Rapport e-mail</label></th>
                    <td><input type="email" id="tinyeclipse_report_email" name="tinyeclipse_report_email" value="<?php echo esc_attr(get_option('tinyeclipse_report_email', '')); ?>" class="regular-text" placeholder="admin@example.com" /></td>
                </tr>
                <tr>
                    <th scope="row">Auto rapport</th>
                    <td><label><input type="checkbox" name="tinyeclipse_auto_report" value="1" <?php checked(get_option('tinyeclipse_auto_report', true)); ?> /> Dagelijks rapport automatisch versturen</label></td>
                </tr>
            </table>
        </div>

        <!-- AI Translation -->
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:16px;">
            <h2 style="margin:0 0 16px;font-size:16px;">🤖 AI Vertaling</h2>
            <table class="form-table" style="margin:0;">
                <tr>
                    <th scope="row"><label for="tinyeclipse_translate_provider">Provider</label></th>
                    <td>
                        <select id="tinyeclipse_translate_provider" name="tinyeclipse_translate_provider">
                            <?php $prov = get_option('tinyeclipse_translate_provider', 'groq'); ?>
                            <option value="groq" <?php selected($prov, 'groq'); ?>>Groq</option>
                            <option value="openai" <?php selected($prov, 'openai'); ?>>OpenAI</option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="tinyeclipse_translate_key">API Key</label></th>
                    <td><input type="password" id="tinyeclipse_translate_key" name="tinyeclipse_translate_key" value="<?php echo esc_attr(get_option('tinyeclipse_translate_key', '')); ?>" class="regular-text" /></td>
                </tr>
                <tr>
                    <th scope="row"><label for="tinyeclipse_translate_model">Model</label></th>
                    <td><input type="text" id="tinyeclipse_translate_model" name="tinyeclipse_translate_model" value="<?php echo esc_attr(get_option('tinyeclipse_translate_model', 'llama-3.3-70b-versatile')); ?>" class="regular-text" /></td>
                </tr>
            </table>
        </div>

        <?php submit_button('Opslaan', 'primary', 'submit', true, ['style' => 'padding:8px 24px;']); ?>
    </form>

    <!-- Embed Code -->
    <?php if ($site_id): ?>
    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-top:16px;">
        <h2 style="margin:0 0 16px;font-size:16px;">📋 Handmatige embed code</h2>
        <textarea readonly rows="5" class="large-text" style="font-family:monospace;font-size:12px;background:#f9fafb;">&lt;script src="<?php echo esc_url(TINYECLIPSE_API_BASE); ?>/widget/v1/widget.js"
  data-tenant="<?php echo esc_attr($site_id); ?>"
  data-api="<?php echo esc_url(TINYECLIPSE_API_BASE); ?>"
  data-color="<?php echo esc_attr(get_option('tinyeclipse_color', '#6C3CE1')); ?>"
  data-name="<?php echo esc_attr(get_option('tinyeclipse_name', get_bloginfo('name') . ' AI')); ?>"
  data-lang="<?php echo esc_attr(get_option('tinyeclipse_lang', 'nl')); ?>"
  data-position="<?php echo esc_attr(get_option('tinyeclipse_position', 'bottom-right')); ?>"
  async&gt;&lt;/script&gt;</textarea>
    </div>
    <?php endif; ?>

    <p style="text-align:center;margin-top:24px;color:#9ca3af;font-size:11px;">TinyEclipse v<?php echo TINYECLIPSE_VERSION; ?> — <a href="<?php echo esc_url(TINYECLIPSE_HUB_URL); ?>" target="_blank" style="color:#6366f1;">Eclipse HUB</a></p>
</div>
