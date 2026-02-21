<?php
/**
 * TinyEclipse Forms Module
 * FluentForm/CF7/Gravity Forms integration: form listing, submissions, tracking.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_Forms {
    private static $instance = null;

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {}

    public function is_active() {
        return function_exists('wpFluent') || class_exists('WPCF7') || class_exists('GFForms');
    }

    /**
     * Get forms audit — overview of all forms and submissions.
     */
    public function audit() {
        $result = [
            'active'       => $this->is_active(),
            'providers'    => [],
            'total_forms'  => 0,
            'total_submissions' => 0,
            'forms'        => [],
            'scanned_at'   => current_time('c'),
        ];

        // Fluent Forms
        if (function_exists('wpFluent')) {
            $result['providers'][] = 'FluentForms';
            $ff_forms = $this->get_fluent_forms();
            $result['forms'] = array_merge($result['forms'], $ff_forms);
            $result['total_forms'] += count($ff_forms);
            $result['total_submissions'] += array_sum(array_column($ff_forms, 'submissions'));
        }

        // Contact Form 7
        if (class_exists('WPCF7')) {
            $result['providers'][] = 'ContactForm7';
            $cf7_forms = $this->get_cf7_forms();
            $result['forms'] = array_merge($result['forms'], $cf7_forms);
            $result['total_forms'] += count($cf7_forms);
        }

        // Gravity Forms
        if (class_exists('GFForms')) {
            $result['providers'][] = 'GravityForms';
            $gf_forms = $this->get_gravity_forms();
            $result['forms'] = array_merge($result['forms'], $gf_forms);
            $result['total_forms'] += count($gf_forms);
            $result['total_submissions'] += array_sum(array_column($gf_forms, 'submissions'));
        }

        return $result;
    }

    /**
     * Get Fluent Forms list with submission counts.
     */
    private function get_fluent_forms() {
        global $wpdb;
        $table = $wpdb->prefix . 'fluentform_forms';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) return [];

        $forms = $wpdb->get_results("SELECT id, title, status, created_at, updated_at FROM {$table} ORDER BY id DESC LIMIT 100");
        $sub_table = $wpdb->prefix . 'fluentform_submissions';

        $result = [];
        foreach ($forms as $form) {
            $count = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$sub_table} WHERE form_id = %d", $form->id));
            $recent = $wpdb->get_var($wpdb->prepare("SELECT created_at FROM {$sub_table} WHERE form_id = %d ORDER BY id DESC LIMIT 1", $form->id));

            $result[] = [
                'id'              => (int)$form->id,
                'title'           => $form->title,
                'provider'        => 'FluentForms',
                'status'          => $form->status,
                'submissions'     => (int)$count,
                'last_submission' => $recent,
                'created_at'      => $form->created_at,
            ];
        }
        return $result;
    }

    /**
     * Get Contact Form 7 forms.
     */
    private function get_cf7_forms() {
        $forms = get_posts(['post_type' => 'wpcf7_contact_form', 'numberposts' => 100]);
        $result = [];
        foreach ($forms as $form) {
            $result[] = [
                'id'          => $form->ID,
                'title'       => $form->post_title,
                'provider'    => 'ContactForm7',
                'status'      => 'active',
                'submissions' => 0, // CF7 doesn't store submissions by default
                'created_at'  => $form->post_date,
            ];
        }
        return $result;
    }

    /**
     * Get Gravity Forms list.
     */
    private function get_gravity_forms() {
        if (!class_exists('GFAPI')) return [];
        $forms = \GFAPI::get_forms();
        $result = [];
        foreach ($forms as $form) {
            $count = \GFAPI::count_entries($form['id']);
            $result[] = [
                'id'          => $form['id'],
                'title'       => $form['title'],
                'provider'    => 'GravityForms',
                'status'      => $form['is_active'] ? 'active' : 'inactive',
                'submissions' => (int)$count,
                'created_at'  => $form['date_created'] ?? null,
            ];
        }
        return $result;
    }

    /**
     * Get submissions for a specific Fluent Form.
     */
    public function get_submissions($form_id, $limit = 50) {
        if (!function_exists('wpFluent')) return [];

        global $wpdb;
        $table = $wpdb->prefix . 'fluentform_submissions';
        $limit = min((int)$limit, 200);

        $subs = $wpdb->get_results($wpdb->prepare(
            "SELECT id, serial_number, response, status, created_at FROM {$table} WHERE form_id = %d ORDER BY id DESC LIMIT %d",
            $form_id, $limit
        ));

        $result = [];
        foreach ($subs as $sub) {
            $fields = json_decode($sub->response, true) ?: [];
            $email = $name = $phone = '';
            foreach (['email', 'e-mail', 'your-email', 'mail'] as $k) { if (!empty($fields[$k])) { $email = $fields[$k]; break; } }
            foreach (['name', 'naam', 'full_name', 'your-name'] as $k) { if (!empty($fields[$k])) { $name = $fields[$k]; break; } }
            foreach (['phone', 'telefoon', 'tel', 'your-phone'] as $k) { if (!empty($fields[$k])) { $phone = $fields[$k]; break; } }

            $result[] = [
                'id'         => (int)$sub->id,
                'serial'     => $sub->serial_number,
                'status'     => $sub->status,
                'name'       => $name,
                'email'      => $email,
                'phone'      => $phone,
                'fields'     => $fields,
                'created_at' => $sub->created_at,
            ];
        }
        return $result;
    }
}
