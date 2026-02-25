<?php
/**
 * TinyEclipse OpenGraph & Link Manager Module
 * Provides REST endpoints for OG tag management, broken link detection, and redirects.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_OpenGraph {
    private static $instance = null;
    const REDIRECTS_KEY = 'tinyeclipse_redirects';

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {}

    // ─── OPENGRAPH ─────────────────────────────────────────

    /**
     * Get OG tags for all published pages/posts.
     */
    public function get_all_og() {
        $posts = get_posts([
            'post_type'   => ['page', 'post'],
            'post_status' => 'publish',
            'numberposts' => 100,
            'orderby'     => 'title',
            'order'       => 'ASC',
        ]);

        $result = [];
        foreach ($posts as $post) {
            $result[] = $this->get_og_for_post($post);
        }
        return $result;
    }

    /**
     * Get OG data for a single post.
     */
    public function get_og_for_post($post) {
        $og_title = '';
        $og_desc  = '';
        $og_image = '';
        $og_type  = 'website';

        // Try Yoast
        $yoast_title = get_post_meta($post->ID, '_yoast_wpseo_opengraph-title', true);
        $yoast_desc  = get_post_meta($post->ID, '_yoast_wpseo_opengraph-description', true);
        $yoast_image = get_post_meta($post->ID, '_yoast_wpseo_opengraph-image', true);
        if ($yoast_title) $og_title = $yoast_title;
        if ($yoast_desc)  $og_desc  = $yoast_desc;
        if ($yoast_image) $og_image = $yoast_image;

        // Try Rank Math
        if (!$og_title) {
            $rm_title = get_post_meta($post->ID, 'rank_math_facebook_title', true);
            if ($rm_title) $og_title = $rm_title;
        }
        if (!$og_desc) {
            $rm_desc = get_post_meta($post->ID, 'rank_math_facebook_description', true);
            if ($rm_desc) $og_desc = $rm_desc;
        }
        if (!$og_image) {
            $rm_image = get_post_meta($post->ID, 'rank_math_facebook_image', true);
            if ($rm_image) $og_image = $rm_image;
        }

        // Fallback to featured image
        if (!$og_image) {
            $thumb = get_the_post_thumbnail_url($post->ID, 'large');
            if ($thumb) $og_image = $thumb;
        }

        // Fallback title/desc
        if (!$og_title) $og_title = $post->post_title;

        $has_og = !empty($yoast_title) || !empty($yoast_desc) || !empty($yoast_image) ||
                  !empty(get_post_meta($post->ID, 'rank_math_facebook_title', true));

        return [
            'id'             => $post->ID,
            'title'          => $post->post_title,
            'url'            => get_permalink($post->ID),
            'type'           => $post->post_type,
            'og_title'       => $og_title,
            'og_description' => $og_desc,
            'og_image'       => $og_image,
            'og_type'        => $og_type,
            'has_og'         => $has_og,
        ];
    }

    /**
     * Update OG tags for a post.
     */
    public function update_og($post_id, $data) {
        $active_plugins = get_option('active_plugins', []);
        $has_yoast = false;
        $has_rm    = false;

        foreach ($active_plugins as $p) {
            if (strpos($p, 'wordpress-seo') !== false) $has_yoast = true;
            if (strpos($p, 'rank-math') !== false)     $has_rm    = true;
        }

        if ($has_yoast) {
            if (isset($data['og_title']))       update_post_meta($post_id, '_yoast_wpseo_opengraph-title', sanitize_text_field($data['og_title']));
            if (isset($data['og_description'])) update_post_meta($post_id, '_yoast_wpseo_opengraph-description', sanitize_text_field($data['og_description']));
            if (isset($data['og_image']))       update_post_meta($post_id, '_yoast_wpseo_opengraph-image', esc_url_raw($data['og_image']));
        } elseif ($has_rm) {
            if (isset($data['og_title']))       update_post_meta($post_id, 'rank_math_facebook_title', sanitize_text_field($data['og_title']));
            if (isset($data['og_description'])) update_post_meta($post_id, 'rank_math_facebook_description', sanitize_text_field($data['og_description']));
            if (isset($data['og_image']))       update_post_meta($post_id, 'rank_math_facebook_image', esc_url_raw($data['og_image']));
        } else {
            // Store in custom meta as fallback
            if (isset($data['og_title']))       update_post_meta($post_id, '_tinyeclipse_og_title', sanitize_text_field($data['og_title']));
            if (isset($data['og_description'])) update_post_meta($post_id, '_tinyeclipse_og_description', sanitize_text_field($data['og_description']));
            if (isset($data['og_image']))       update_post_meta($post_id, '_tinyeclipse_og_image', esc_url_raw($data['og_image']));
        }

        return $this->get_og_for_post(get_post($post_id));
    }

    // ─── SEO PAGES AUDIT ───────────────────────────────────

    /**
     * Get SEO audit for pages (delegates to SEO class).
     */
    public function get_seo_pages($limit = 50) {
        if (class_exists('TinyEclipse_SEO')) {
            return TinyEclipse_SEO::instance()->audit_pages($limit);
        }
        return [];
    }

    // ─── BROKEN LINKS ──────────────────────────────────────

    /**
     * Scan recent content for broken links.
     */
    public function scan_broken_links($limit = 20) {
        $posts = get_posts([
            'post_type'   => ['page', 'post'],
            'post_status' => 'publish',
            'numberposts' => $limit,
            'orderby'     => 'modified',
            'order'       => 'DESC',
        ]);

        $broken = [];
        foreach ($posts as $post) {
            preg_match_all('/<a\s[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)<\/a>/i', $post->post_content, $matches, PREG_SET_ORDER);
            foreach ($matches as $match) {
                $url = $match[1];
                $anchor = wp_strip_all_tags($match[2]);

                // Skip anchors, mailto, tel
                if (strpos($url, '#') === 0 || strpos($url, 'mailto:') === 0 || strpos($url, 'tel:') === 0) continue;

                // Make relative URLs absolute
                if (strpos($url, '/') === 0) {
                    $url = home_url($url);
                }

                // Only check internal links and a sample of external
                if (strpos($url, home_url()) === 0) {
                    $response = wp_remote_head($url, ['timeout' => 5, 'sslverify' => false, 'redirection' => 3]);
                    if (is_wp_error($response)) {
                        $broken[] = [
                            'url'         => $url,
                            'source_page' => $post->post_title,
                            'source_url'  => get_permalink($post->ID),
                            'status_code' => 0,
                            'anchor_text' => mb_substr($anchor, 0, 50),
                        ];
                    } else {
                        $code = wp_remote_retrieve_response_code($response);
                        if ($code >= 400) {
                            $broken[] = [
                                'url'         => $url,
                                'source_page' => $post->post_title,
                                'source_url'  => get_permalink($post->ID),
                                'status_code' => $code,
                                'anchor_text' => mb_substr($anchor, 0, 50),
                            ];
                        }
                    }
                }
            }
        }

        return $broken;
    }

    // ─── REDIRECTS ─────────────────────────────────────────

    public function get_redirects() {
        $redirects = get_option(self::REDIRECTS_KEY, []);
        if (!is_array($redirects)) $redirects = [];
        return $redirects;
    }

    public function create_redirect($data) {
        $redirects = $this->get_redirects();
        $max_id = 0;
        foreach ($redirects as $r) {
            if ($r['id'] > $max_id) $max_id = $r['id'];
        }

        $new = [
            'id'       => $max_id + 1,
            'from_url' => sanitize_text_field($data['from_url'] ?? ''),
            'to_url'   => sanitize_text_field($data['to_url'] ?? ''),
            'type'     => (int) ($data['type'] ?? 301),
            'hits'     => 0,
            'created'  => current_time('c'),
        ];

        $redirects[] = $new;
        update_option(self::REDIRECTS_KEY, $redirects);
        return $new;
    }

    public function delete_redirect($id) {
        $redirects = $this->get_redirects();
        $redirects = array_values(array_filter($redirects, function($r) use ($id) {
            return $r['id'] != $id;
        }));
        update_option(self::REDIRECTS_KEY, $redirects);
        return true;
    }

    /**
     * Handle redirect matching on template_redirect.
     */
    public function handle_redirects() {
        if (is_admin()) return;

        $request_uri = $_SERVER['REQUEST_URI'] ?? '';
        $redirects = $this->get_redirects();

        foreach ($redirects as &$r) {
            if ($r['from_url'] === $request_uri || trailingslashit($r['from_url']) === $request_uri) {
                $r['hits'] = ($r['hits'] ?? 0) + 1;
                update_option(self::REDIRECTS_KEY, $redirects);
                wp_redirect($r['to_url'], $r['type']);
                exit;
            }
        }
    }
}
