<?php
/**
 * TinyEclipse SEO Module
 * SEO audit: meta tags, headings, images, Rank Math/Yoast integration, sitemap, robots.txt.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_SEO {
    private static $instance = null;

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {}

    /**
     * Run full SEO audit.
     */
    public function audit() {
        $checks = [];

        // 1. Site title & tagline
        $title = get_bloginfo('name');
        $tagline = get_bloginfo('description');
        $checks['site_title'] = [
            'label'  => 'Site Title',
            'status' => !empty($title) && $title !== 'Just another WordPress site' ? 'pass' : 'warn',
            'detail' => $title ?: '(empty)',
        ];
        $checks['tagline'] = [
            'label'  => 'Tagline',
            'status' => !empty($tagline) && $tagline !== 'Just another WordPress site' ? 'pass' : 'warn',
            'detail' => $tagline ?: '(empty)',
        ];

        // 2. Search engine visibility
        $discourage = get_option('blog_public');
        $checks['search_visibility'] = [
            'label'  => 'Search Engine Visibility',
            'status' => $discourage == '1' ? 'pass' : 'fail',
            'detail' => $discourage == '1' ? 'Search engines allowed' : 'Search engines BLOCKED (noindex)',
            'fix'    => $discourage != '1' ? 'Settings → Reading → uncheck "Discourage search engines"' : null,
        ];

        // 3. Permalink structure
        $permalink = get_option('permalink_structure');
        $checks['permalinks'] = [
            'label'  => 'Permalink Structure',
            'status' => !empty($permalink) && $permalink !== '/?p=%post_id%' ? 'pass' : 'warn',
            'detail' => $permalink ?: 'Default (plain)',
        ];

        // 4. SEO plugin
        $active_plugins = get_option('active_plugins', []);
        $seo_plugin = null;
        foreach ($active_plugins as $p) {
            if (strpos($p, 'wordpress-seo') !== false) { $seo_plugin = 'Yoast SEO'; break; }
            if (strpos($p, 'rank-math') !== false) { $seo_plugin = 'Rank Math'; break; }
            if (strpos($p, 'seo-by-flavor') !== false) { $seo_plugin = 'SEOPress'; break; }
        }
        $checks['seo_plugin'] = [
            'label'  => 'SEO Plugin',
            'status' => $seo_plugin ? 'pass' : 'warn',
            'detail' => $seo_plugin ?: 'No SEO plugin detected',
        ];

        // 5. Sitemap
        $sitemap_url = get_site_url() . '/sitemap.xml';
        $sitemap_check = wp_remote_head($sitemap_url, ['timeout' => 5, 'sslverify' => false]);
        $sitemap_ok = !is_wp_error($sitemap_check) && wp_remote_retrieve_response_code($sitemap_check) === 200;
        $checks['sitemap'] = [
            'label'  => 'XML Sitemap',
            'status' => $sitemap_ok ? 'pass' : 'warn',
            'detail' => $sitemap_ok ? 'Sitemap found' : 'No sitemap at /sitemap.xml',
        ];

        // 6. Robots.txt
        $robots_url = get_site_url() . '/robots.txt';
        $robots_check = wp_remote_get($robots_url, ['timeout' => 5, 'sslverify' => false]);
        $robots_ok = !is_wp_error($robots_check) && wp_remote_retrieve_response_code($robots_check) === 200;
        $robots_body = $robots_ok ? wp_remote_retrieve_body($robots_check) : '';
        $checks['robots'] = [
            'label'  => 'Robots.txt',
            'status' => $robots_ok ? 'pass' : 'warn',
            'detail' => $robots_ok ? 'Robots.txt found (' . strlen($robots_body) . ' bytes)' : 'No robots.txt',
        ];

        // 7. Pages without meta description (sample)
        $pages_audit = $this->audit_pages(20);
        $missing_meta = count(array_filter($pages_audit, function ($p) { return empty($p['meta_description']); }));
        $checks['meta_descriptions'] = [
            'label'  => 'Meta Descriptions',
            'status' => $missing_meta === 0 ? 'pass' : ($missing_meta <= 3 ? 'warn' : 'fail'),
            'detail' => $missing_meta === 0 ? 'All sampled pages have meta descriptions' : "{$missing_meta}/" . count($pages_audit) . " pages missing meta description",
            'pages'  => $pages_audit,
        ];

        // 8. Images without alt text
        $images_without_alt = $this->count_images_without_alt();
        $checks['image_alt'] = [
            'label'  => 'Image Alt Text',
            'status' => $images_without_alt === 0 ? 'pass' : ($images_without_alt <= 5 ? 'warn' : 'fail'),
            'detail' => $images_without_alt === 0 ? 'All recent images have alt text' : "{$images_without_alt} images missing alt text",
        ];

        // Calculate score
        $total = count($checks);
        $passed = count(array_filter($checks, function ($c) { return $c['status'] === 'pass'; }));
        $score = $total > 0 ? round(($passed / $total) * 100) : 0;

        return [
            'score'      => $score,
            'total'      => $total,
            'passed'     => $passed,
            'checks'     => $checks,
            'seo_plugin' => $seo_plugin,
            'scanned_at' => current_time('c'),
        ];
    }

    /**
     * Audit individual pages for SEO completeness.
     */
    public function audit_pages($limit = 20) {
        $pages = get_posts([
            'post_type'   => ['page', 'post'],
            'post_status' => 'publish',
            'numberposts' => $limit,
            'orderby'     => 'date',
            'order'       => 'DESC',
        ]);

        $result = [];
        foreach ($pages as $page) {
            $meta_desc = '';
            // Try Yoast
            $yoast = get_post_meta($page->ID, '_yoast_wpseo_metadesc', true);
            if ($yoast) $meta_desc = $yoast;
            // Try Rank Math
            if (!$meta_desc) {
                $rm = get_post_meta($page->ID, 'rank_math_description', true);
                if ($rm) $meta_desc = $rm;
            }

            $title_length = mb_strlen($page->post_title);
            $content_length = str_word_count(wp_strip_all_tags($page->post_content));

            $result[] = [
                'id'               => $page->ID,
                'title'            => $page->post_title,
                'type'             => $page->post_type,
                'url'              => get_permalink($page->ID),
                'title_length'     => $title_length,
                'title_ok'         => $title_length >= 10 && $title_length <= 70,
                'meta_description' => $meta_desc,
                'meta_length'      => mb_strlen($meta_desc),
                'meta_ok'          => mb_strlen($meta_desc) >= 50 && mb_strlen($meta_desc) <= 160,
                'word_count'       => $content_length,
                'content_ok'       => $content_length >= 300,
            ];
        }

        return $result;
    }

    /**
     * Count images without alt text.
     */
    private function count_images_without_alt() {
        global $wpdb;
        $count = $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->posts} p
             LEFT JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = '_wp_attachment_image_alt'
             WHERE p.post_type = 'attachment'
             AND p.post_mime_type LIKE 'image/%'
             AND (pm.meta_value IS NULL OR pm.meta_value = '')
             AND p.post_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)"
        );
        return (int)$count;
    }
}
