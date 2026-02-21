<?php
/**
 * TinyEclipse AI Translator Module
 * AI-powered translation via Groq/OpenAI: single page, batch, full language translation.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_Translator {
    private static $instance = null;

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {}

    /**
     * Get configured AI provider settings.
     */
    private function get_config() {
        return [
            'api_key'  => get_option('tinyeclipse_translate_key', ''),
            'provider' => get_option('tinyeclipse_translate_provider', 'groq'),
            'model'    => get_option('tinyeclipse_translate_model', 'llama-3.3-70b-versatile'),
        ];
    }

    /**
     * Check if translator is configured.
     */
    public function is_configured() {
        $config = $this->get_config();
        return !empty($config['api_key']);
    }

    /**
     * Get translation overview — what needs translating.
     */
    public function get_overview() {
        if (!function_exists('icl_get_languages')) {
            return ['active' => false, 'message' => 'WPML not installed'];
        }

        $langs = icl_get_languages('skip_missing=0');
        $default = apply_filters('wpml_default_language', null);

        $overview = [
            'active'           => true,
            'configured'       => $this->is_configured(),
            'provider'         => get_option('tinyeclipse_translate_provider', 'groq'),
            'model'            => get_option('tinyeclipse_translate_model', ''),
            'default_language' => $default,
            'languages'        => [],
        ];

        foreach ($langs as $code => $lang) {
            if ($code === $default) continue;
            $missing = TinyEclipse_Translation::instance()->get_missing($code);
            $overview['languages'][] = [
                'code'         => $code,
                'name'         => $lang['native_name'],
                'missing_count'=> count($missing),
            ];
        }

        return $overview;
    }

    /**
     * Translate a single post to a target language.
     */
    public function translate_single($post_id, $target_lang) {
        if (!$this->is_configured()) {
            return new WP_Error('not_configured', 'AI translator not configured');
        }
        if (!function_exists('icl_get_languages')) {
            return new WP_Error('no_wpml', 'WPML not installed');
        }

        $post = get_post($post_id);
        if (!$post) return new WP_Error('not_found', 'Post not found');

        $config = $this->get_config();
        $source_lang = apply_filters('wpml_default_language', 'nl');

        // Get language name for prompt
        $lang_names = ['nl' => 'Dutch', 'en' => 'English', 'fr' => 'French', 'de' => 'German', 'es' => 'Spanish', 'it' => 'Italian', 'pt' => 'Portuguese', 'tr' => 'Turkish', 'ar' => 'Arabic'];
        $target_name = $lang_names[$target_lang] ?? $target_lang;
        $source_name = $lang_names[$source_lang] ?? $source_lang;

        // Translate title
        $translated_title = $this->ai_translate($post->post_title, $source_name, $target_name, $config, 'title');

        // Translate content (split into chunks if large)
        $translated_content = $this->ai_translate($post->post_content, $source_name, $target_name, $config, 'content');

        // Translate excerpt if exists
        $translated_excerpt = '';
        if (!empty($post->post_excerpt)) {
            $translated_excerpt = $this->ai_translate($post->post_excerpt, $source_name, $target_name, $config, 'excerpt');
        }

        if (is_wp_error($translated_title) || is_wp_error($translated_content)) {
            return new WP_Error('translation_failed', 'AI translation failed');
        }

        // Deduct tokens
        tinyeclipse_deduct_tokens('ai_translate');

        return [
            'post_id'     => $post_id,
            'target_lang' => $target_lang,
            'title'       => $translated_title,
            'content'     => $translated_content,
            'excerpt'     => $translated_excerpt,
            'source_lang' => $source_lang,
        ];
    }

    /**
     * Apply a translation — create/update the WPML translation post.
     */
    public function apply_translation($post_id, $target_lang, $title, $content, $excerpt = '') {
        if (!function_exists('icl_get_languages')) {
            return new WP_Error('no_wpml', 'WPML not installed');
        }

        $post = get_post($post_id);
        if (!$post) return new WP_Error('not_found', 'Post not found');

        $trid = apply_filters('wpml_element_trid', null, $post_id, 'post_' . $post->post_type);
        $translations = apply_filters('wpml_get_element_translations', null, $trid, 'post_' . $post->post_type);

        // Check if translation already exists
        if ($translations && isset($translations[$target_lang]) && !empty($translations[$target_lang]->element_id)) {
            // Update existing
            $trans_id = $translations[$target_lang]->element_id;
            wp_update_post([
                'ID'           => $trans_id,
                'post_title'   => $title,
                'post_content' => $content,
                'post_excerpt' => $excerpt,
            ]);
            return ['status' => 'updated', 'post_id' => $trans_id, 'language' => $target_lang];
        }

        // Create new translation
        $new_post = wp_insert_post([
            'post_title'   => $title,
            'post_content' => $content,
            'post_excerpt' => $excerpt,
            'post_type'    => $post->post_type,
            'post_status'  => 'draft',
            'post_author'  => $post->post_author,
        ]);

        if (is_wp_error($new_post)) return $new_post;

        // Link to WPML
        $element_type = 'post_' . $post->post_type;
        do_action('wpml_set_element_language_details', [
            'element_id'    => $new_post,
            'element_type'  => $element_type,
            'trid'          => $trid,
            'language_code' => $target_lang,
        ]);

        return ['status' => 'created', 'post_id' => $new_post, 'language' => $target_lang];
    }

    /**
     * Call AI API for translation.
     */
    private function ai_translate($text, $source_lang, $target_lang, $config, $type = 'content') {
        if (empty($text)) return '';

        $system_prompt = "You are a professional translator. Translate the following {$type} from {$source_lang} to {$target_lang}. "
            . "Maintain the original formatting, HTML tags, and structure. "
            . "Do not add explanations, just return the translated text.";

        if ($config['provider'] === 'groq') {
            $url = 'https://api.groq.com/openai/v1/chat/completions';
        } else {
            $url = 'https://api.openai.com/v1/chat/completions';
        }

        $response = wp_remote_post($url, [
            'timeout' => 60,
            'headers' => [
                'Content-Type'  => 'application/json',
                'Authorization' => 'Bearer ' . $config['api_key'],
            ],
            'body' => wp_json_encode([
                'model'    => $config['model'],
                'messages' => [
                    ['role' => 'system', 'content' => $system_prompt],
                    ['role' => 'user', 'content' => $text],
                ],
                'temperature' => 0.3,
                'max_tokens'  => 4096,
            ]),
        ]);

        if (is_wp_error($response)) return $response;

        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (empty($body['choices'][0]['message']['content'])) {
            return new WP_Error('ai_error', 'No translation returned from AI');
        }

        return trim($body['choices'][0]['message']['content']);
    }

    /**
     * Get batch translation progress.
     */
    public function get_progress() {
        return get_option('tinyeclipse_translate_progress', [
            'running'   => false,
            'language'  => null,
            'total'     => 0,
            'completed' => 0,
            'errors'    => 0,
            'started_at'=> null,
        ]);
    }
}
