<?php
/**
 * TinyEclipse FAQ Module
 * CRUD for FAQ items stored as custom post type or wp_options.
 * Syncs with AI knowledge base for chat assistant.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_FAQ {
    private static $instance = null;
    const OPTION_KEY = 'tinyeclipse_faq_items';

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {}

    /**
     * Get all FAQ items.
     */
    public function get_all() {
        $items = get_option(self::OPTION_KEY, []);
        if (!is_array($items)) $items = [];
        usort($items, function($a, $b) {
            return ($a['order'] ?? 0) - ($b['order'] ?? 0);
        });
        return $items;
    }

    /**
     * Get a single FAQ item by ID.
     */
    public function get($id) {
        $items = $this->get_all();
        foreach ($items as $item) {
            if ($item['id'] == $id) return $item;
        }
        return null;
    }

    /**
     * Create a new FAQ item.
     */
    public function create($data) {
        $items = $this->get_all();
        $max_id = 0;
        foreach ($items as $item) {
            if ($item['id'] > $max_id) $max_id = $item['id'];
        }

        $new = [
            'id'         => $max_id + 1,
            'question'   => sanitize_text_field($data['question'] ?? ''),
            'answer'     => wp_kses_post($data['answer'] ?? ''),
            'category'   => sanitize_text_field($data['category'] ?? ''),
            'order'      => count($items),
            'created_at' => current_time('c'),
            'updated_at' => current_time('c'),
        ];

        $items[] = $new;
        update_option(self::OPTION_KEY, $items);

        return $new;
    }

    /**
     * Update an existing FAQ item.
     */
    public function update($id, $data) {
        $items = $this->get_all();
        $updated = null;

        foreach ($items as &$item) {
            if ($item['id'] == $id) {
                if (isset($data['question'])) $item['question'] = sanitize_text_field($data['question']);
                if (isset($data['answer']))   $item['answer']   = wp_kses_post($data['answer']);
                if (isset($data['category'])) $item['category'] = sanitize_text_field($data['category']);
                $item['updated_at'] = current_time('c');
                $updated = $item;
                break;
            }
        }

        if ($updated) {
            update_option(self::OPTION_KEY, $items);
        }

        return $updated;
    }

    /**
     * Delete a FAQ item.
     */
    public function delete($id) {
        $items = $this->get_all();
        $items = array_values(array_filter($items, function($item) use ($id) {
            return $item['id'] != $id;
        }));
        update_option(self::OPTION_KEY, $items);
        return true;
    }

    /**
     * Reorder FAQ items.
     */
    public function reorder($order_data) {
        $items = $this->get_all();
        $order_map = [];
        foreach ($order_data as $entry) {
            $order_map[$entry['id']] = $entry['order'];
        }

        foreach ($items as &$item) {
            if (isset($order_map[$item['id']])) {
                $item['order'] = (int) $order_map[$item['id']];
            }
        }

        usort($items, function($a, $b) {
            return ($a['order'] ?? 0) - ($b['order'] ?? 0);
        });

        update_option(self::OPTION_KEY, $items);
        return $items;
    }

    /**
     * Get FAQ as structured text for AI knowledge base.
     */
    public function get_knowledge_text() {
        $items = $this->get_all();
        if (empty($items)) return '';

        $text = "Veelgestelde vragen (FAQ):\n\n";
        foreach ($items as $item) {
            $text .= "V: {$item['question']}\n";
            $text .= "A: {$item['answer']}\n\n";
        }
        return $text;
    }
}
