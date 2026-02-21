<?php
/**
 * TinyEclipse Translation Module
 * WPML audit: missing translations, incomplete content, language coverage.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_Translation {
    private static $instance = null;

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {}

    public function is_active() {
        return function_exists('icl_get_languages');
    }

    /**
     * Run translation audit.
     */
    public function audit() {
        if (!$this->is_active()) {
            return ['active' => false, 'message' => 'WPML not installed'];
        }

        $langs = icl_get_languages('skip_missing=0');
        $default_lang = apply_filters('wpml_default_language', null);
        $lang_count = count($langs);

        // Get all published content in default language
        do_action('wpml_switch_language', $default_lang);
        $pages = get_posts(['post_type' => ['page', 'post'], 'post_status' => 'publish', 'numberposts' => 200, 'suppress_filters' => false]);
        do_action('wpml_switch_language', null);

        $total_items = count($pages);
        $missing = [];
        $incomplete = [];
        $coverage = [];

        foreach ($langs as $lang_code => $lang_info) {
            if ($lang_code === $default_lang) continue;
            $coverage[$lang_code] = ['total' => $total_items, 'translated' => 0, 'missing' => 0, 'incomplete' => 0];
        }

        foreach ($pages as $page) {
            $trid = apply_filters('wpml_element_trid', null, $page->ID, 'post_' . $page->post_type);
            $translations = apply_filters('wpml_get_element_translations', null, $trid, 'post_' . $page->post_type);

            foreach ($langs as $lang_code => $lang_info) {
                if ($lang_code === $default_lang) continue;

                $has_translation = false;
                $is_complete = false;

                if ($translations && isset($translations[$lang_code])) {
                    $t = $translations[$lang_code];
                    if (!empty($t->element_id)) {
                        $has_translation = true;
                        $trans_post = get_post($t->element_id);
                        if ($trans_post && !empty($trans_post->post_content)) {
                            $orig_len = mb_strlen(wp_strip_all_tags($page->post_content));
                            $trans_len = mb_strlen(wp_strip_all_tags($trans_post->post_content));
                            $is_complete = $orig_len > 0 ? ($trans_len / $orig_len) > 0.3 : true;
                        }
                    }
                }

                if (!$has_translation) {
                    $missing[] = ['page_id' => $page->ID, 'title' => $page->post_title, 'type' => $page->post_type, 'language' => $lang_code];
                    $coverage[$lang_code]['missing']++;
                } elseif (!$is_complete) {
                    $incomplete[] = ['page_id' => $page->ID, 'title' => $page->post_title, 'type' => $page->post_type, 'language' => $lang_code];
                    $coverage[$lang_code]['incomplete']++;
                    $coverage[$lang_code]['translated']++;
                } else {
                    $coverage[$lang_code]['translated']++;
                }
            }
        }

        // Calculate coverage percentages
        foreach ($coverage as $lang => &$c) {
            $c['percentage'] = $c['total'] > 0 ? round(($c['translated'] / $c['total']) * 100) : 0;
        }

        $total_possible = $total_items * (count($langs) - 1);
        $total_translated = array_sum(array_column($coverage, 'translated'));
        $overall_pct = $total_possible > 0 ? round(($total_translated / $total_possible) * 100) : 0;

        return [
            'active'           => true,
            'default_language' => $default_lang,
            'language_count'   => $lang_count,
            'languages'        => array_map(function ($l) {
                return ['code' => $l['code'], 'name' => $l['native_name'], 'english_name' => $l['translated_name'], 'active' => (bool)$l['active']];
            }, array_values($langs)),
            'total_items'      => $total_items,
            'coverage'         => $coverage,
            'overall_coverage' => $overall_pct,
            'missing_count'    => count($missing),
            'incomplete_count' => count($incomplete),
            'missing'          => array_slice($missing, 0, 50),
            'incomplete'       => array_slice($incomplete, 0, 50),
            'scanned_at'       => current_time('c'),
        ];
    }

    /**
     * Get missing translations for a specific language.
     */
    public function get_missing($lang) {
        if (!$this->is_active()) return [];

        $default_lang = apply_filters('wpml_default_language', null);
        do_action('wpml_switch_language', $default_lang);
        $pages = get_posts(['post_type' => ['page', 'post'], 'post_status' => 'publish', 'numberposts' => 200, 'suppress_filters' => false]);
        do_action('wpml_switch_language', null);

        $missing = [];
        foreach ($pages as $page) {
            $trid = apply_filters('wpml_element_trid', null, $page->ID, 'post_' . $page->post_type);
            $translations = apply_filters('wpml_get_element_translations', null, $trid, 'post_' . $page->post_type);

            if (!$translations || !isset($translations[$lang]) || empty($translations[$lang]->element_id)) {
                $missing[] = [
                    'id' => $page->ID, 'title' => $page->post_title, 'type' => $page->post_type,
                    'url' => get_permalink($page->ID), 'word_count' => str_word_count(wp_strip_all_tags($page->post_content)),
                ];
            }
        }

        return $missing;
    }

    /**
     * Get incomplete translations for a specific language.
     */
    public function get_incomplete($lang) {
        if (!$this->is_active()) return [];

        $default_lang = apply_filters('wpml_default_language', null);
        do_action('wpml_switch_language', $default_lang);
        $pages = get_posts(['post_type' => ['page', 'post'], 'post_status' => 'publish', 'numberposts' => 200, 'suppress_filters' => false]);
        do_action('wpml_switch_language', null);

        $incomplete = [];
        foreach ($pages as $page) {
            $trid = apply_filters('wpml_element_trid', null, $page->ID, 'post_' . $page->post_type);
            $translations = apply_filters('wpml_get_element_translations', null, $trid, 'post_' . $page->post_type);

            if ($translations && isset($translations[$lang]) && !empty($translations[$lang]->element_id)) {
                $trans_post = get_post($translations[$lang]->element_id);
                if ($trans_post) {
                    $orig_len = mb_strlen(wp_strip_all_tags($page->post_content));
                    $trans_len = mb_strlen(wp_strip_all_tags($trans_post->post_content));
                    $ratio = $orig_len > 0 ? $trans_len / $orig_len : 1;

                    if ($ratio < 0.3) {
                        $incomplete[] = [
                            'id' => $page->ID, 'title' => $page->post_title, 'type' => $page->post_type,
                            'trans_id' => $trans_post->ID, 'ratio' => round($ratio * 100),
                            'orig_length' => $orig_len, 'trans_length' => $trans_len,
                        ];
                    }
                }
            }
        }

        return $incomplete;
    }

    /**
     * Get content for a specific post (for translation).
     */
    public function get_content($post_id) {
        $post = get_post($post_id);
        if (!$post) return null;

        return [
            'id'      => $post->ID,
            'title'   => $post->post_title,
            'content' => $post->post_content,
            'excerpt' => $post->post_excerpt,
            'type'    => $post->post_type,
            'status'  => $post->post_status,
            'url'     => get_permalink($post->ID),
        ];
    }
}
