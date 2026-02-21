<?php
/**
 * TinyEclipse Jobs Module
 * Jobs CPT integration: WP Job Manager, recruitment, AI job generator, smart links, applications.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_Jobs {
    private static $instance = null;

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    /**
     * Check if WP Job Manager is active OR ACF-based jobs exist.
     */
    public function is_active() {
        // Check WP Job Manager
        if (post_type_exists('job_listing')) {
            return true;
        }
        
        // Check ACF-based jobs (post_type 'job')
        if (post_type_exists('job')) {
            $job_posts = get_posts([
                'post_type' => 'job',
                'post_status' => 'publish',
                'numberposts' => 1,
                'fields' => 'ids'
            ]);
            return !empty($job_posts);
        }
        
        // Check if ACF has job-related field groups
        if (function_exists('acf_get_field_groups')) {
            $field_groups = acf_get_field_groups();
            foreach ($field_groups as $group) {
                if (strpos(strtolower($group['title']), 'job') !== false || 
                    strpos(strtolower($group['title']), 'vacature') !== false ||
                    strpos(strtolower($group['title']), 'career') !== false) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Get job post type (WP Job Manager or ACF-based).
     */
    private function get_job_post_type() {
        if (post_type_exists('job_listing')) {
            return 'job_listing';
        }
        if (post_type_exists('job')) {
            return 'job';
        }
        return 'job_listing'; // fallback
    }

    /**
     * Get jobs audit — overview of all job listings.
     */
    public function audit() {
        if (!$this->is_active()) {
            return ['active' => false, 'message' => 'No job system found (WP Job Manager or ACF jobs)'];
        }

        $job_post_type = $this->get_job_post_type();
        $jobs = get_posts([
            'post_type'   => $job_post_type,
            'post_status' => ['publish', 'expired', 'draft', 'pending'],
            'numberposts' => 200,
            'orderby'     => 'date',
            'order'       => 'DESC',
        ]);

        $active = $expired = $draft = 0;
        $listings = [];

        foreach ($jobs as $job) {
            $status = $job->post_status;
            if ($status === 'publish') $active++;
            elseif ($status === 'expired') $expired++;
            else $draft++;

            $company = get_post_meta($job->ID, '_company_name', true);
            $location = get_post_meta($job->ID, '_job_location', true);
            $type = '';
            $terms = wp_get_post_terms($job->ID, 'job_listing_type');
            if (!is_wp_error($terms) && !empty($terms)) {
                $type = $terms[0]->name;
            }

            $applications = get_posts([
                'post_type'   => 'job_application',
                'post_status' => 'any',
                'numberposts' => -1,
                'meta_query'  => [['key' => '_job_id', 'value' => $job->ID]],
            ]);

            $listings[] = [
                'id'           => $job->ID,
                'title'        => $job->post_title,
                'status'       => $status,
                'company'      => $company,
                'location'     => $location,
                'type'         => $type,
                'applications' => count($applications),
                'url'          => get_permalink($job->ID),
                'created_at'   => $job->post_date,
                'modified_at'  => $job->post_modified,
            ];
        }

        // Total applications
        $total_apps = get_posts([
            'post_type'   => 'job_application',
            'post_status' => 'any',
            'numberposts' => -1,
            'fields'      => 'ids',
        ]);

        return [
            'active'            => true,
            'total_jobs'        => count($jobs),
            'active_jobs'       => $active,
            'expired_jobs'      => $expired,
            'draft_jobs'        => $draft,
            'total_applications'=> count($total_apps),
            'jobs'              => $listings,
            'scanned_at'        => current_time('c'),
        ];
    }

    /**
     * Get single job detail.
     */
    public function get_job($job_id) {
        $job = get_post($job_id);
        if (!$job || $job->post_type !== 'job_listing') return null;

        $applications = get_posts([
            'post_type'   => 'job_application',
            'post_status' => 'any',
            'numberposts' => 50,
            'meta_query'  => [['key' => '_job_id', 'value' => $job_id]],
        ]);

        $apps = [];
        foreach ($applications as $app) {
            $apps[] = [
                'id'         => $app->ID,
                'name'       => $app->post_title,
                'email'      => get_post_meta($app->ID, '_candidate_email', true),
                'message'    => $app->post_content,
                'status'     => $app->post_status,
                'created_at' => $app->post_date,
            ];
        }

        return [
            'id'           => $job->ID,
            'title'        => $job->post_title,
            'content'      => $job->post_content,
            'status'       => $job->post_status,
            'company'      => get_post_meta($job->ID, '_company_name', true),
            'location'     => get_post_meta($job->ID, '_job_location', true),
            'salary'       => get_post_meta($job->ID, '_job_salary', true),
            'url'          => get_permalink($job->ID),
            'applications' => $apps,
            'created_at'   => $job->post_date,
        ];
    }

    /**
     * Create a new job listing.
     */
    public function create_job($data) {
        $post_data = [
            'post_type'    => 'job_listing',
            'post_title'   => sanitize_text_field($data['title'] ?? ''),
            'post_content' => wp_kses_post($data['content'] ?? ''),
            'post_status'  => sanitize_text_field($data['status'] ?? 'draft'),
            'post_author'  => get_current_user_id() ?: 1,
        ];

        $post_id = wp_insert_post($post_data, true);
        if (is_wp_error($post_id)) return $post_id;

        // Set meta
        if (!empty($data['company'])) update_post_meta($post_id, '_company_name', sanitize_text_field($data['company']));
        if (!empty($data['location'])) update_post_meta($post_id, '_job_location', sanitize_text_field($data['location']));
        if (!empty($data['salary'])) update_post_meta($post_id, '_job_salary', sanitize_text_field($data['salary']));
        if (!empty($data['application_email'])) update_post_meta($post_id, '_application', sanitize_email($data['application_email']));

        // Set job type taxonomy
        if (!empty($data['type'])) {
            wp_set_object_terms($post_id, sanitize_text_field($data['type']), 'job_listing_type');
        }

        tinyeclipse_log('jobs', 'info', "Job created: {$data['title']}", ['job_id' => $post_id]);

        return ['status' => 'created', 'job_id' => $post_id, 'url' => get_permalink($post_id)];
    }

    /**
     * Update an existing job listing.
     */
    public function update_job($job_id, $data) {
        $job = get_post($job_id);
        if (!$job || $job->post_type !== 'job_listing') return new WP_Error('not_found', 'Job not found');

        $update = ['ID' => $job_id];
        if (isset($data['title'])) $update['post_title'] = sanitize_text_field($data['title']);
        if (isset($data['content'])) $update['post_content'] = wp_kses_post($data['content']);
        if (isset($data['status'])) $update['post_status'] = sanitize_text_field($data['status']);

        $result = wp_update_post($update, true);
        if (is_wp_error($result)) return $result;

        if (isset($data['company'])) update_post_meta($job_id, '_company_name', sanitize_text_field($data['company']));
        if (isset($data['location'])) update_post_meta($job_id, '_job_location', sanitize_text_field($data['location']));

        return ['status' => 'updated', 'job_id' => $job_id];
    }

    /**
     * Close (expire) a job listing.
     */
    public function close_job($job_id) {
        $job = get_post($job_id);
        if (!$job || $job->post_type !== 'job_listing') return new WP_Error('not_found', 'Job not found');

        wp_update_post(['ID' => $job_id, 'post_status' => 'expired']);
        return ['status' => 'closed', 'job_id' => $job_id];
    }

    /**
     * Publish a draft job.
     */
    public function publish_job($job_id) {
        $job = get_post($job_id);
        if (!$job || $job->post_type !== 'job_listing') return new WP_Error('not_found', 'Job not found');

        wp_update_post(['ID' => $job_id, 'post_status' => 'publish']);
        return ['status' => 'published', 'job_id' => $job_id, 'url' => get_permalink($job_id)];
    }

    /**
     * Duplicate a job listing.
     */
    public function duplicate_job($job_id) {
        $job = get_post($job_id);
        if (!$job || $job->post_type !== 'job_listing') return new WP_Error('not_found', 'Job not found');

        $new_id = wp_insert_post([
            'post_type'    => 'job_listing',
            'post_title'   => $job->post_title . ' (kopie)',
            'post_content' => $job->post_content,
            'post_status'  => 'draft',
            'post_author'  => $job->post_author,
        ]);

        if (is_wp_error($new_id)) return $new_id;

        // Copy meta
        $meta = get_post_meta($job_id);
        foreach ($meta as $key => $values) {
            if (strpos($key, '_') === 0 || strpos($key, 'job') !== false) {
                update_post_meta($new_id, $key, maybe_unserialize($values[0]));
            }
        }

        return ['status' => 'duplicated', 'original_id' => $job_id, 'new_id' => $new_id];
    }

    /**
     * Get all applications across all jobs.
     */
    public function get_applications($limit = 50) {
        $apps = get_posts([
            'post_type'   => 'job_application',
            'post_status' => 'any',
            'numberposts' => $limit,
            'orderby'     => 'date',
            'order'       => 'DESC',
        ]);

        $result = [];
        foreach ($apps as $app) {
            $job_id = get_post_meta($app->ID, '_job_id', true);
            $job = $job_id ? get_post($job_id) : null;

            $result[] = [
                'id'         => $app->ID,
                'name'       => $app->post_title,
                'email'      => get_post_meta($app->ID, '_candidate_email', true),
                'message'    => wp_strip_all_tags($app->post_content),
                'job_id'     => $job_id,
                'job_title'  => $job ? $job->post_title : 'Onbekend',
                'status'     => $app->post_status,
                'created_at' => $app->post_date,
            ];
        }

        return $result;
    }

    /**
     * AI-generate a job description.
     */
    public function ai_generate($data) {
        $api_key = get_option('tinyeclipse_translate_key', '');
        $provider = get_option('tinyeclipse_translate_provider', 'groq');
        $model = get_option('tinyeclipse_translate_model', 'llama-3.3-70b-versatile');

        if (empty($api_key)) return new WP_Error('not_configured', 'AI not configured');

        $title = sanitize_text_field($data['title'] ?? '');
        $company = sanitize_text_field($data['company'] ?? get_bloginfo('name'));
        $location = sanitize_text_field($data['location'] ?? '');
        $type = sanitize_text_field($data['type'] ?? 'fulltime');
        $lang = sanitize_text_field($data['language'] ?? 'nl');

        $lang_map = ['nl' => 'Dutch', 'en' => 'English', 'fr' => 'French'];
        $lang_name = $lang_map[$lang] ?? 'Dutch';

        $prompt = "Generate a professional job listing in {$lang_name} for the position: {$title}\n"
            . "Company: {$company}\n"
            . "Location: {$location}\n"
            . "Type: {$type}\n\n"
            . "Include: job description, responsibilities, requirements, what we offer.\n"
            . "Format with HTML headings (h3) and bullet lists (ul/li).\n"
            . "Keep it professional, engaging, and between 300-500 words.";

        $url = $provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';

        $response = wp_remote_post($url, [
            'timeout' => 60,
            'headers' => ['Content-Type' => 'application/json', 'Authorization' => 'Bearer ' . $api_key],
            'body'    => wp_json_encode([
                'model' => $model,
                'messages' => [
                    ['role' => 'system', 'content' => 'You are an expert HR copywriter.'],
                    ['role' => 'user', 'content' => $prompt],
                ],
                'temperature' => 0.7,
                'max_tokens' => 2048,
            ]),
        ]);

        if (is_wp_error($response)) return $response;

        $body = json_decode(wp_remote_retrieve_body($response), true);
        $content = $body['choices'][0]['message']['content'] ?? '';

        if (empty($content)) return new WP_Error('ai_error', 'No content generated');

        tinyeclipse_deduct_tokens('ai_job_generate');

        return [
            'title'   => $title,
            'content' => $content,
            'company' => $company,
            'location'=> $location,
            'type'    => $type,
        ];
    }

    /**
     * Get smart links for a job (social sharing URLs).
     */
    public function get_smart_links($job_id) {
        $job = get_post($job_id);
        if (!$job) return [];

        $url = urlencode(get_permalink($job_id));
        $title = urlencode($job->post_title);
        $company = urlencode(get_post_meta($job_id, '_company_name', true) ?: get_bloginfo('name'));

        return [
            'permalink' => get_permalink($job_id),
            'linkedin'  => "https://www.linkedin.com/sharing/share-offsite/?url={$url}",
            'facebook'  => "https://www.facebook.com/sharer/sharer.php?u={$url}",
            'twitter'   => "https://twitter.com/intent/tweet?url={$url}&text=" . urlencode("Vacature: {$job->post_title} bij ") . $company,
            'whatsapp'  => "https://wa.me/?text=" . urlencode("{$job->post_title} — ") . $url,
            'email'     => "mailto:?subject=" . urlencode("Vacature: {$job->post_title}") . "&body=" . urlencode("Bekijk deze vacature: ") . $url,
        ];
    }
}
