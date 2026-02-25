<?php
/**
 * TinyEclipse Site Intelligence Module
 * 
 * Deep site analysis on first connect:
 * - WPML-aware page grouping (1 page = 1 content unit with N language variants)
 * - Translation completeness rating per page and per language
 * - Main language detection + secondary language analysis
 * - Content quality scoring
 * - Clone/copy detection (cyber resilience)
 * - Sector intelligence hints
 * - SEO per-language audit
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_Site_Intelligence {
    private static $instance = null;

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {}

    // ═══════════════════════════════════════════════════════════════
    // DEEP SCAN — Full site intelligence report
    // ═══════════════════════════════════════════════════════════════

    /**
     * Run a comprehensive deep scan of the entire site.
     * This is triggered on first connect and can be re-run on demand.
     */
    public function run_deep_scan() {
        $start = microtime(true);

        $scan = [
            'scan_version'  => 2,
            'scanned_at'    => current_time('c'),
            'site_url'      => get_site_url(),
            'site_name'     => get_bloginfo('name'),
            'environment'   => tinyeclipse_is_staging() ? 'staging' : 'production',
        ];

        // 1. WPML / Language Intelligence
        $scan['languages'] = $this->analyze_languages();

        // 2. Content Intelligence — WPML-aware page grouping
        $scan['content'] = $this->analyze_content();

        // 3. Translation Completeness
        $scan['translation'] = $this->analyze_translation_completeness();

        // 4. SEO per-language
        $scan['seo_per_language'] = $this->analyze_seo_per_language();

        // 5. Cyber Resilience
        $scan['cyber'] = $this->analyze_cyber_resilience();

        // 6. Technology Stack
        $scan['stack'] = $this->analyze_tech_stack();

        // 7. Content Quality
        $scan['quality'] = $this->analyze_content_quality();

        // 8. Overall Rating
        $scan['rating'] = $this->calculate_overall_rating($scan);

        $scan['scan_duration_ms'] = round((microtime(true) - $start) * 1000);

        // Cache the scan result
        update_option('tinyeclipse_last_deep_scan', $scan);
        update_option('tinyeclipse_last_deep_scan_at', current_time('mysql'));

        return $scan;
    }

    /**
     * Get the cached deep scan result.
     */
    public function get_last_scan() {
        return get_option('tinyeclipse_last_deep_scan', null);
    }

    // ═══════════════════════════════════════════════════════════════
    // 1. LANGUAGE INTELLIGENCE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Analyze language setup: detect WPML, main language, secondary languages.
     */
    public function analyze_languages() {
        $has_wpml = function_exists('icl_get_languages');

        if (!$has_wpml) {
            $locale = get_locale();
            return [
                'wpml_active'       => false,
                'multilingual'      => false,
                'language_count'    => 1,
                'default_language'  => substr($locale, 0, 2),
                'default_locale'    => $locale,
                'languages'         => [
                    [
                        'code'         => substr($locale, 0, 2),
                        'locale'       => $locale,
                        'name'         => $this->locale_to_name($locale),
                        'is_default'   => true,
                        'active'       => true,
                    ]
                ],
                'analysis' => 'Single-language site. No WPML detected.',
            ];
        }

        // WPML is active
        $langs = icl_get_languages('skip_missing=0');
        $default_lang = apply_filters('wpml_default_language', null);

        $language_list = [];
        foreach ($langs as $code => $info) {
            $language_list[] = [
                'code'          => $code,
                'locale'        => $info['default_locale'] ?? $code,
                'name'          => $info['native_name'] ?? $code,
                'english_name'  => $info['translated_name'] ?? $code,
                'is_default'    => ($code === $default_lang),
                'active'        => (bool)($info['active'] ?? true),
                'flag_url'      => $info['country_flag_url'] ?? null,
                'url'           => $info['url'] ?? null,
            ];
        }

        // Determine if the default language makes sense
        $analysis = $this->analyze_language_choice($default_lang, $language_list);

        return [
            'wpml_active'       => true,
            'multilingual'      => true,
            'language_count'    => count($langs),
            'default_language'  => $default_lang,
            'languages'         => $language_list,
            'analysis'          => $analysis,
        ];
    }

    /**
     * Analyze whether the default language choice is logical.
     */
    private function analyze_language_choice($default_lang, $languages) {
        $notes = [];

        // Check if English is a secondary language but content was started in another language
        $has_en = false;
        $has_nl = false;
        $has_fr = false;
        foreach ($languages as $l) {
            if ($l['code'] === 'en') $has_en = true;
            if ($l['code'] === 'nl') $has_nl = true;
            if ($l['code'] === 'fr') $has_fr = true;
        }

        if ($default_lang === 'nl' && $has_en) {
            $notes[] = 'Default language is Dutch (NL). English is a secondary language. Consider if English should be the primary language for international reach.';
        }
        if ($default_lang === 'en' && ($has_nl || $has_fr)) {
            $notes[] = 'Default language is English. Local languages (NL/FR) are secondary — good for international-first approach.';
        }
        if (count($languages) === 3 && $has_en && $has_nl && $has_fr) {
            $notes[] = 'Trilingual setup (EN/NL/FR) detected — typical Belgian business configuration.';
        }

        return implode(' ', $notes) ?: 'Language configuration looks standard.';
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. CONTENT INTELLIGENCE — WPML-aware page grouping
    // ═══════════════════════════════════════════════════════════════

    /**
     * Analyze all content with WPML-aware grouping.
     * 1 page = 1 content unit, regardless of how many language variants exist.
     */
    public function analyze_content() {
        $has_wpml = function_exists('icl_get_languages');

        if (!$has_wpml) {
            return $this->analyze_content_simple();
        }

        return $this->analyze_content_wpml();
    }

    /**
     * Simple content analysis (no WPML).
     */
    private function analyze_content_simple() {
        $pages = wp_count_posts('page');
        $posts = wp_count_posts('post');
        $products = class_exists('WooCommerce') ? wp_count_posts('product') : null;

        $content_units = [];
        $all_pages = get_posts([
            'post_type'   => ['page', 'post'],
            'post_status' => 'publish',
            'numberposts' => 500,
        ]);

        foreach ($all_pages as $p) {
            $word_count = str_word_count(wp_strip_all_tags($p->post_content));
            $content_units[] = [
                'id'          => $p->ID,
                'title'       => $p->post_title,
                'type'        => $p->post_type,
                'url'         => get_permalink($p->ID),
                'word_count'  => $word_count,
                'languages'   => 1,
                'variants'    => [['lang' => substr(get_locale(), 0, 2), 'id' => $p->ID, 'status' => 'complete']],
            ];
        }

        return [
            'wpml_grouped'       => false,
            'total_content_units' => count($content_units),
            'total_wp_posts'     => (int)$pages->publish + (int)$posts->publish,
            'pages_count'        => (int)$pages->publish,
            'posts_count'        => (int)$posts->publish,
            'products_count'     => $products ? (int)$products->publish : 0,
            'content_units'      => $content_units,
            'note'               => 'No WPML — each WordPress post/page is 1 content unit.',
        ];
    }

    /**
     * WPML-aware content analysis — group by translation group (trid).
     */
    private function analyze_content_wpml() {
        $default_lang = apply_filters('wpml_default_language', null);
        $langs = icl_get_languages('skip_missing=0');
        $lang_count = count($langs);

        // Get all content in default language only
        do_action('wpml_switch_language', $default_lang);
        $all_pages = get_posts([
            'post_type'        => ['page', 'post'],
            'post_status'      => 'publish',
            'numberposts'      => 500,
            'suppress_filters' => false,
        ]);
        do_action('wpml_switch_language', null);

        // Also get products if WooCommerce active
        $products_count = 0;
        if (class_exists('WooCommerce')) {
            do_action('wpml_switch_language', $default_lang);
            $products = get_posts([
                'post_type'        => 'product',
                'post_status'      => 'publish',
                'numberposts'      => 500,
                'suppress_filters' => false,
            ]);
            do_action('wpml_switch_language', null);
            $products_count = count($products);
        }

        $content_units = [];
        $total_variants = 0;

        foreach ($all_pages as $page) {
            $trid = apply_filters('wpml_element_trid', null, $page->ID, 'post_' . $page->post_type);
            $translations = apply_filters('wpml_get_element_translations', null, $trid, 'post_' . $page->post_type);

            $variants = [];
            $orig_word_count = str_word_count(wp_strip_all_tags($page->post_content));

            // Default language variant
            $variants[] = [
                'lang'       => $default_lang,
                'id'         => $page->ID,
                'status'     => 'complete',
                'word_count' => $orig_word_count,
                'ratio'      => 100,
            ];

            // Check each secondary language
            foreach ($langs as $lang_code => $lang_info) {
                if ($lang_code === $default_lang) continue;

                if ($translations && isset($translations[$lang_code]) && !empty($translations[$lang_code]->element_id)) {
                    $trans_post = get_post($translations[$lang_code]->element_id);
                    if ($trans_post && !empty($trans_post->post_content)) {
                        $trans_word_count = str_word_count(wp_strip_all_tags($trans_post->post_content));
                        $ratio = $orig_word_count > 0 ? round(($trans_word_count / $orig_word_count) * 100) : 100;

                        $status = 'complete';
                        if ($ratio < 30) $status = 'stub';
                        elseif ($ratio < 70) $status = 'incomplete';

                        $variants[] = [
                            'lang'       => $lang_code,
                            'id'         => (int)$translations[$lang_code]->element_id,
                            'status'     => $status,
                            'word_count' => $trans_word_count,
                            'ratio'      => $ratio,
                        ];
                    } else {
                        $variants[] = [
                            'lang'   => $lang_code,
                            'id'     => (int)$translations[$lang_code]->element_id,
                            'status' => 'empty',
                            'word_count' => 0,
                            'ratio'  => 0,
                        ];
                    }
                } else {
                    $variants[] = [
                        'lang'   => $lang_code,
                        'id'     => null,
                        'status' => 'missing',
                        'word_count' => 0,
                        'ratio'  => 0,
                    ];
                }
            }

            $total_variants += count($variants);

            $content_units[] = [
                'id'            => $page->ID,
                'trid'          => $trid,
                'title'         => $page->post_title,
                'type'          => $page->post_type,
                'url'           => get_permalink($page->ID),
                'word_count'    => $orig_word_count,
                'languages'     => count($variants),
                'complete_count'=> count(array_filter($variants, fn($v) => $v['status'] === 'complete')),
                'variants'      => $variants,
            ];
        }

        $pages_count = count(array_filter($content_units, fn($u) => $u['type'] === 'page'));
        $posts_count = count(array_filter($content_units, fn($u) => $u['type'] === 'post'));

        // Count total WP posts (all languages) for comparison
        do_action('wpml_switch_language', 'all');
        $total_wp_pages = wp_count_posts('page')->publish;
        $total_wp_posts = wp_count_posts('post')->publish;
        do_action('wpml_switch_language', null);

        return [
            'wpml_grouped'        => true,
            'total_content_units' => count($content_units),
            'total_wp_posts'      => (int)$total_wp_pages + (int)$total_wp_posts,
            'total_variants'      => $total_variants,
            'expected_variants'   => count($content_units) * $lang_count,
            'pages_count'         => $pages_count,
            'posts_count'         => $posts_count,
            'products_count'      => $products_count,
            'language_count'      => $lang_count,
            'default_language'    => $default_lang,
            'content_units'       => $content_units,
            'note'                => sprintf(
                'WPML detected: %d unique content units × %d languages = %d expected variants. WordPress shows %d total posts/pages.',
                count($content_units), $lang_count, count($content_units) * $lang_count,
                (int)$total_wp_pages + (int)$total_wp_posts
            ),
        ];
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. TRANSLATION COMPLETENESS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Analyze translation completeness across all languages.
     */
    public function analyze_translation_completeness() {
        if (!function_exists('icl_get_languages')) {
            return ['active' => false, 'message' => 'No WPML — single language site'];
        }

        $langs = icl_get_languages('skip_missing=0');
        $default_lang = apply_filters('wpml_default_language', null);

        // Get content units from analyze_content
        $content = $this->analyze_content_wpml();
        $units = $content['content_units'];

        $per_language = [];
        foreach ($langs as $code => $info) {
            if ($code === $default_lang) {
                $per_language[$code] = [
                    'name'       => $info['native_name'],
                    'is_default' => true,
                    'total'      => count($units),
                    'complete'   => count($units),
                    'incomplete' => 0,
                    'missing'    => 0,
                    'empty'      => 0,
                    'stub'       => 0,
                    'percentage' => 100,
                    'rating'     => 'A+',
                ];
                continue;
            }

            $complete = $incomplete = $missing = $empty = $stub = 0;
            foreach ($units as $unit) {
                foreach ($unit['variants'] as $v) {
                    if ($v['lang'] !== $code) continue;
                    switch ($v['status']) {
                        case 'complete':   $complete++; break;
                        case 'incomplete': $incomplete++; break;
                        case 'missing':    $missing++; break;
                        case 'empty':      $empty++; break;
                        case 'stub':       $stub++; break;
                    }
                }
            }

            $total = count($units);
            $pct = $total > 0 ? round(($complete / $total) * 100) : 0;

            $per_language[$code] = [
                'name'       => $info['native_name'],
                'is_default' => false,
                'total'      => $total,
                'complete'   => $complete,
                'incomplete' => $incomplete,
                'missing'    => $missing,
                'empty'      => $empty,
                'stub'       => $stub,
                'percentage' => $pct,
                'rating'     => $this->percentage_to_rating($pct),
            ];
        }

        // Overall score
        $secondary_langs = array_filter($per_language, fn($l) => !$l['is_default']);
        $overall_pct = count($secondary_langs) > 0
            ? round(array_sum(array_column($secondary_langs, 'percentage')) / count($secondary_langs))
            : 100;

        return [
            'active'              => true,
            'overall_percentage'  => $overall_pct,
            'overall_rating'      => $this->percentage_to_rating($overall_pct),
            'per_language'        => $per_language,
            'total_content_units' => count($units),
            'recommendation'      => $this->translation_recommendation($per_language, $default_lang),
        ];
    }

    /**
     * Generate translation recommendations.
     */
    private function translation_recommendation($per_language, $default_lang) {
        $recs = [];

        foreach ($per_language as $code => $data) {
            if ($data['is_default']) continue;

            if ($data['missing'] > 0) {
                $recs[] = sprintf(
                    '%s: %d pagina\'s missen een vertaling. Dit is slecht voor SEO en gebruikerservaring.',
                    $data['name'], $data['missing']
                );
            }
            if ($data['stub'] > 0) {
                $recs[] = sprintf(
                    '%s: %d pagina\'s hebben een stub-vertaling (< 30%% van origineel). Deze moeten aangevuld worden.',
                    $data['name'], $data['stub']
                );
            }
            if ($data['incomplete'] > 0) {
                $recs[] = sprintf(
                    '%s: %d pagina\'s hebben een onvolledige vertaling (30-70%% van origineel).',
                    $data['name'], $data['incomplete']
                );
            }
        }

        if (empty($recs)) {
            return 'Alle vertalingen zijn compleet. Uitstekend werk!';
        }

        return implode("\n", $recs);
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. SEO PER-LANGUAGE AUDIT
    // ═══════════════════════════════════════════════════════════════

    /**
     * Run SEO checks per language variant.
     */
    public function analyze_seo_per_language() {
        if (!function_exists('icl_get_languages')) {
            // Single language — delegate to existing SEO module
            if (class_exists('TinyEclipse_SEO')) {
                return ['single_language' => true, 'audit' => TinyEclipse_SEO::instance()->audit()];
            }
            return ['single_language' => true];
        }

        $langs = icl_get_languages('skip_missing=0');
        $default_lang = apply_filters('wpml_default_language', null);
        $results = [];

        foreach ($langs as $code => $info) {
            do_action('wpml_switch_language', $code);

            $pages = get_posts([
                'post_type'        => ['page', 'post'],
                'post_status'      => 'publish',
                'numberposts'      => 50,
                'suppress_filters' => false,
            ]);

            $missing_meta = 0;
            $short_titles = 0;
            $thin_content = 0;
            $total = count($pages);

            foreach ($pages as $page) {
                // Meta description check
                $meta = get_post_meta($page->ID, '_yoast_wpseo_metadesc', true)
                     ?: get_post_meta($page->ID, 'rank_math_description', true);
                if (empty($meta)) $missing_meta++;

                // Title length
                if (mb_strlen($page->post_title) < 10) $short_titles++;

                // Thin content
                if (str_word_count(wp_strip_all_tags($page->post_content)) < 100) $thin_content++;
            }

            $score = $total > 0 ? round((($total - $missing_meta - $short_titles - $thin_content) / ($total * 3)) * 100) : 0;
            $score = max(0, min(100, $score));

            $results[$code] = [
                'language'       => $info['native_name'],
                'total_pages'    => $total,
                'missing_meta'   => $missing_meta,
                'short_titles'   => $short_titles,
                'thin_content'   => $thin_content,
                'seo_score'      => $score,
                'rating'         => $this->percentage_to_rating($score),
            ];

            do_action('wpml_switch_language', null);
        }

        return [
            'per_language' => $results,
            'note'         => 'SEO audit per language variant. Each language should have complete meta descriptions and sufficient content.',
        ];
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. CYBER RESILIENCE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Analyze cyber resilience: clone detection, security posture.
     */
    public function analyze_cyber_resilience() {
        $site_url = get_site_url();
        $domain = wp_parse_url($site_url, PHP_URL_HOST);

        $checks = [];

        // 1. SSL check
        $is_ssl = is_ssl();
        $checks['ssl'] = [
            'label'  => 'SSL Certificate',
            'status' => $is_ssl ? 'pass' : 'fail',
            'detail' => $is_ssl ? 'Site uses HTTPS' : 'Site does NOT use HTTPS — critical security issue',
        ];

        // 2. WordPress version
        $wp_version = get_bloginfo('version');
        $checks['wp_version'] = [
            'label'  => 'WordPress Version',
            'status' => version_compare($wp_version, '6.4', '>=') ? 'pass' : 'warn',
            'detail' => "WordPress {$wp_version}",
        ];

        // 3. PHP version
        $php_version = phpversion();
        $checks['php_version'] = [
            'label'  => 'PHP Version',
            'status' => version_compare($php_version, '8.0', '>=') ? 'pass' : 'warn',
            'detail' => "PHP {$php_version}",
        ];

        // 4. Debug mode
        $checks['debug_mode'] = [
            'label'  => 'Debug Mode',
            'status' => defined('WP_DEBUG') && WP_DEBUG ? 'warn' : 'pass',
            'detail' => defined('WP_DEBUG') && WP_DEBUG ? 'WP_DEBUG is ON — disable in production' : 'Debug mode disabled',
        ];

        // 5. File editor
        $checks['file_editor'] = [
            'label'  => 'File Editor',
            'status' => defined('DISALLOW_FILE_EDIT') && DISALLOW_FILE_EDIT ? 'pass' : 'warn',
            'detail' => defined('DISALLOW_FILE_EDIT') && DISALLOW_FILE_EDIT ? 'File editor disabled' : 'File editor enabled — consider disabling',
        ];

        // 6. Admin username check
        $admin_user = get_user_by('login', 'admin');
        $checks['admin_username'] = [
            'label'  => 'Admin Username',
            'status' => $admin_user ? 'fail' : 'pass',
            'detail' => $admin_user ? 'Default "admin" username exists — rename for security' : 'No default admin username',
        ];

        // 7. Clone detection — check for similar domains
        $clone_hints = $this->detect_clones($domain);
        $checks['clone_detection'] = [
            'label'  => 'Clone Detection',
            'status' => empty($clone_hints) ? 'pass' : 'info',
            'detail' => empty($clone_hints) ? 'No clone indicators found' : 'Potential related domains detected',
            'hints'  => $clone_hints,
        ];

        // 8. Database prefix
        global $wpdb;
        $checks['db_prefix'] = [
            'label'  => 'Database Prefix',
            'status' => $wpdb->prefix === 'wp_' ? 'warn' : 'pass',
            'detail' => $wpdb->prefix === 'wp_' ? 'Default prefix wp_ — consider changing' : "Custom prefix: {$wpdb->prefix}",
        ];

        // Calculate score
        $total = count($checks);
        $passed = count(array_filter($checks, fn($c) => $c['status'] === 'pass'));
        $score = $total > 0 ? round(($passed / $total) * 100) : 0;

        return [
            'score'    => $score,
            'rating'   => $this->percentage_to_rating($score),
            'checks'   => $checks,
            'domain'   => $domain,
        ];
    }

    /**
     * Detect potential clone/copy sites by analyzing domain patterns.
     */
    private function detect_clones($domain) {
        $hints = [];

        // Check for staging counterpart
        $staging_domain = 'staging.' . $domain;
        $staging_check = wp_remote_head('https://' . $staging_domain, ['timeout' => 3, 'sslverify' => false]);
        if (!is_wp_error($staging_check) && wp_remote_retrieve_response_code($staging_check) < 400) {
            $hints[] = [
                'type'   => 'staging',
                'domain' => $staging_domain,
                'note'   => 'Staging environment detected',
            ];
        }

        // Check for www variant
        $has_www = strpos($domain, 'www.') === 0;
        $alt_domain = $has_www ? substr($domain, 4) : 'www.' . $domain;
        $alt_check = wp_remote_head('https://' . $alt_domain, ['timeout' => 3, 'sslverify' => false]);
        if (!is_wp_error($alt_check) && wp_remote_retrieve_response_code($alt_check) < 400) {
            $hints[] = [
                'type'   => 'www_variant',
                'domain' => $alt_domain,
                'note'   => 'WWW variant accessible — ensure proper redirect',
            ];
        }

        // Check if this is a known multi-site group (from tinyeclipse options)
        $related_domains = get_option('tinyeclipse_related_domains', []);
        if (!empty($related_domains)) {
            foreach ($related_domains as $rd) {
                if ($rd !== $domain) {
                    $hints[] = [
                        'type'   => 'related',
                        'domain' => $rd,
                        'note'   => 'Related domain in same client group',
                    ];
                }
            }
        }

        return $hints;
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. TECHNOLOGY STACK
    // ═══════════════════════════════════════════════════════════════

    /**
     * Analyze the technology stack.
     */
    public function analyze_tech_stack() {
        $active_plugins = get_option('active_plugins', []);
        $theme = wp_get_theme();

        $categories = [
            'ecommerce'   => [],
            'seo'         => [],
            'forms'       => [],
            'translation' => [],
            'security'    => [],
            'performance' => [],
            'builder'     => [],
            'analytics'   => [],
            'other'       => [],
        ];

        $plugin_map = [
            'woocommerce'       => ['ecommerce', 'WooCommerce'],
            'wordpress-seo'     => ['seo', 'Yoast SEO'],
            'rank-math'         => ['seo', 'Rank Math'],
            'sitepress-multilingual-cms' => ['translation', 'WPML'],
            'wpml-string-translation'    => ['translation', 'WPML String Translation'],
            'wpml-translation-management'=> ['translation', 'WPML Translation Management'],
            'fluentform'        => ['forms', 'Fluent Forms'],
            'contact-form-7'    => ['forms', 'Contact Form 7'],
            'gravityforms'      => ['forms', 'Gravity Forms'],
            'wordfence'         => ['security', 'Wordfence'],
            'sucuri-scanner'    => ['security', 'Sucuri'],
            'ithemes-security'  => ['security', 'iThemes Security'],
            'wp-super-cache'    => ['performance', 'WP Super Cache'],
            'w3-total-cache'    => ['performance', 'W3 Total Cache'],
            'litespeed-cache'   => ['performance', 'LiteSpeed Cache'],
            'wp-rocket'         => ['performance', 'WP Rocket'],
            'elementor'         => ['builder', 'Elementor'],
            'js_composer'       => ['builder', 'WPBakery'],
            'beaver-builder'    => ['builder', 'Beaver Builder'],
            'google-site-kit'   => ['analytics', 'Google Site Kit'],
            'fluent-smtp'       => ['other', 'FluentSMTP'],
            'wp-mail-smtp'      => ['other', 'WP Mail SMTP'],
            'wp-job-manager'    => ['other', 'WP Job Manager'],
            'ameliabooking'     => ['other', 'Amelia Booking'],
            'tinyeclipse-connector' => ['other', 'TinyEclipse Connector'],
            'tinyeclipse-wc'    => ['ecommerce', 'TinyEclipse WC'],
            'tinyeclipse-analytics' => ['analytics', 'TinyEclipse Analytics'],
        ];

        foreach ($active_plugins as $plugin) {
            $slug = explode('/', $plugin)[0];
            $found = false;
            foreach ($plugin_map as $key => $info) {
                if (strpos($slug, $key) !== false) {
                    $categories[$info[0]][] = $info[1];
                    $found = true;
                    break;
                }
            }
            if (!$found) {
                $categories['other'][] = $slug;
            }
        }

        return [
            'wordpress_version' => get_bloginfo('version'),
            'php_version'       => phpversion(),
            'theme'             => [
                'name'    => $theme->get('Name'),
                'version' => $theme->get('Version'),
                'author'  => $theme->get('Author'),
                'parent'  => $theme->parent() ? $theme->parent()->get('Name') : null,
            ],
            'plugin_count'      => count($active_plugins),
            'categories'        => array_filter($categories, fn($c) => !empty($c)),
            'has_page_builder'  => !empty($categories['builder']),
            'has_ecommerce'     => !empty($categories['ecommerce']),
            'has_seo_plugin'    => !empty($categories['seo']),
            'has_caching'       => !empty($categories['performance']),
        ];
    }

    // ═══════════════════════════════════════════════════════════════
    // 7. CONTENT QUALITY
    // ═══════════════════════════════════════════════════════════════

    /**
     * Analyze content quality across all pages.
     */
    public function analyze_content_quality() {
        $default_lang = function_exists('icl_get_languages')
            ? apply_filters('wpml_default_language', null)
            : null;

        if ($default_lang) {
            do_action('wpml_switch_language', $default_lang);
        }

        $pages = get_posts([
            'post_type'        => ['page', 'post'],
            'post_status'      => 'publish',
            'numberposts'      => 200,
            'suppress_filters' => false,
        ]);

        if ($default_lang) {
            do_action('wpml_switch_language', null);
        }

        $total = count($pages);
        $thin = 0;       // < 100 words
        $short = 0;      // 100-300 words
        $good = 0;       // 300-1000 words
        $long = 0;       // > 1000 words
        $no_images = 0;
        $total_words = 0;

        foreach ($pages as $page) {
            $content = wp_strip_all_tags($page->post_content);
            $wc = str_word_count($content);
            $total_words += $wc;

            if ($wc < 100) $thin++;
            elseif ($wc < 300) $short++;
            elseif ($wc < 1000) $good++;
            else $long++;

            // Check for images
            if (strpos($page->post_content, '<img') === false) $no_images++;
        }

        $avg_words = $total > 0 ? round($total_words / $total) : 0;

        // Quality score: penalize thin content, reward good/long
        $quality_score = $total > 0
            ? round((($good + $long) / $total) * 100)
            : 0;

        return [
            'total_pages'    => $total,
            'total_words'    => $total_words,
            'avg_words'      => $avg_words,
            'thin_content'   => $thin,
            'short_content'  => $short,
            'good_content'   => $good,
            'long_content'   => $long,
            'no_images'      => $no_images,
            'quality_score'  => $quality_score,
            'rating'         => $this->percentage_to_rating($quality_score),
        ];
    }

    // ═══════════════════════════════════════════════════════════════
    // 8. OVERALL RATING
    // ═══════════════════════════════════════════════════════════════

    /**
     * Calculate overall site intelligence rating.
     */
    private function calculate_overall_rating($scan) {
        $scores = [];

        // Translation completeness (weight: 30%)
        if (!empty($scan['translation']['overall_percentage'])) {
            $scores['translation'] = ['score' => $scan['translation']['overall_percentage'], 'weight' => 30, 'label' => 'Vertalingen'];
        }

        // SEO (weight: 25%)
        $seo_scores = [];
        if (!empty($scan['seo_per_language']['per_language'])) {
            foreach ($scan['seo_per_language']['per_language'] as $l) {
                $seo_scores[] = $l['seo_score'];
            }
        }
        if (!empty($seo_scores)) {
            $scores['seo'] = ['score' => round(array_sum($seo_scores) / count($seo_scores)), 'weight' => 25, 'label' => 'SEO'];
        }

        // Cyber resilience (weight: 25%)
        if (!empty($scan['cyber']['score'])) {
            $scores['cyber'] = ['score' => $scan['cyber']['score'], 'weight' => 25, 'label' => 'Beveiliging'];
        }

        // Content quality (weight: 20%)
        if (!empty($scan['quality']['quality_score'])) {
            $scores['quality'] = ['score' => $scan['quality']['quality_score'], 'weight' => 20, 'label' => 'Content Kwaliteit'];
        }

        // Weighted average
        $total_weight = array_sum(array_column($scores, 'weight'));
        $weighted_sum = 0;
        foreach ($scores as $s) {
            $weighted_sum += $s['score'] * $s['weight'];
        }
        $overall = $total_weight > 0 ? round($weighted_sum / $total_weight) : 0;

        return [
            'overall_score'  => $overall,
            'overall_rating' => $this->percentage_to_rating($overall),
            'breakdown'      => $scores,
        ];
    }

    // ═══════════════════════════════════════════════════════════════
    // KNOWLEDGE TEXT — For AI context injection
    // ═══════════════════════════════════════════════════════════════

    /**
     * Generate knowledge text about site intelligence for AI.
     */
    public function get_knowledge_text() {
        $scan = $this->get_last_scan();
        if (!$scan) return '';

        $lines = [];
        $lines[] = "=== SITE INTELLIGENCE ===";

        // Languages
        if (!empty($scan['languages'])) {
            $l = $scan['languages'];
            if ($l['multilingual']) {
                $lang_names = array_map(fn($lang) => $lang['name'], $l['languages']);
                $lines[] = "Languages: " . implode(', ', $lang_names) . " (default: {$l['default_language']})";
                $lines[] = "Language analysis: {$l['analysis']}";
            } else {
                $lines[] = "Single language site: {$l['default_language']}";
            }
        }

        // Content
        if (!empty($scan['content'])) {
            $c = $scan['content'];
            $lines[] = "Content units: {$c['total_content_units']} unique pages/posts";
            if ($c['wpml_grouped']) {
                $lines[] = "WordPress shows {$c['total_wp_posts']} total posts (includes all language variants)";
                $lines[] = "Real unique content: {$c['total_content_units']} pages × {$c['language_count']} languages";
            }
        }

        // Translation
        if (!empty($scan['translation']) && $scan['translation']['active']) {
            $t = $scan['translation'];
            $lines[] = "Translation completeness: {$t['overall_percentage']}% (rating: {$t['overall_rating']})";
            $lines[] = "Recommendation: {$t['recommendation']}";
        }

        // Rating
        if (!empty($scan['rating'])) {
            $lines[] = "Overall site rating: {$scan['rating']['overall_score']}% ({$scan['rating']['overall_rating']})";
        }

        return implode("\n", $lines);
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    private function percentage_to_rating($pct) {
        if ($pct >= 95) return 'A+';
        if ($pct >= 85) return 'A';
        if ($pct >= 75) return 'B+';
        if ($pct >= 65) return 'B';
        if ($pct >= 50) return 'C';
        if ($pct >= 35) return 'D';
        return 'F';
    }

    private function locale_to_name($locale) {
        $map = [
            'nl_NL' => 'Nederlands', 'nl_BE' => 'Nederlands (België)',
            'en_US' => 'English', 'en_GB' => 'English (UK)',
            'fr_FR' => 'Français', 'fr_BE' => 'Français (Belgique)',
            'de_DE' => 'Deutsch', 'es_ES' => 'Español',
            'it_IT' => 'Italiano', 'pt_PT' => 'Português',
        ];
        return $map[$locale] ?? $locale;
    }
}
