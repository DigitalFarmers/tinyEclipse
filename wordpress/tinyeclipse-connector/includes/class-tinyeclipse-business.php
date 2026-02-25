<?php
/**
 * TinyEclipse Business Profile Module
 * Manages business profile, locations, and opening hours.
 * Stored in wp_options for simplicity and portability.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_Business {
    private static $instance = null;
    const PROFILE_KEY   = 'tinyeclipse_business_profile';
    const LOCATIONS_KEY = 'tinyeclipse_business_locations';

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {}

    // ─── PROFILE ───────────────────────────────────────────

    public function get_profile() {
        $defaults = [
            'name'        => get_bloginfo('name'),
            'address'     => '',
            'city'        => '',
            'postal_code' => '',
            'country'     => 'BE',
            'phone'       => '',
            'email'       => get_option('admin_email'),
            'website'     => home_url(),
            'vat_number'  => '',
            'kbo_number'  => '',
            'logo_url'    => '',
            'social'      => [
                'facebook'  => '',
                'instagram' => '',
                'linkedin'  => '',
                'tiktok'    => '',
                'youtube'   => '',
            ],
        ];

        $saved = get_option(self::PROFILE_KEY, []);
        if (!is_array($saved)) $saved = [];

        return array_merge($defaults, $saved);
    }

    public function save_profile($data) {
        $profile = $this->get_profile();

        $text_fields = ['name', 'address', 'city', 'postal_code', 'country', 'phone', 'email', 'website', 'vat_number', 'kbo_number', 'logo_url'];
        foreach ($text_fields as $field) {
            if (isset($data[$field])) {
                $profile[$field] = sanitize_text_field($data[$field]);
            }
        }

        if (isset($data['social']) && is_array($data['social'])) {
            foreach ($data['social'] as $key => $url) {
                $profile['social'][$key] = esc_url_raw($url);
            }
        }

        update_option(self::PROFILE_KEY, $profile);
        return $profile;
    }

    // ─── LOCATIONS ─────────────────────────────────────────

    public function get_locations() {
        $locations = get_option(self::LOCATIONS_KEY, []);
        if (!is_array($locations)) $locations = [];
        return $locations;
    }

    public function get_location($id) {
        foreach ($this->get_locations() as $loc) {
            if ($loc['id'] == $id) return $loc;
        }
        return null;
    }

    public function create_location($data) {
        $locations = $this->get_locations();
        $max_id = 0;
        foreach ($locations as $loc) {
            if ($loc['id'] > $max_id) $max_id = $loc['id'];
        }

        $new = [
            'id'              => $max_id + 1,
            'name'            => sanitize_text_field($data['name'] ?? ''),
            'address'         => sanitize_text_field($data['address'] ?? ''),
            'city'            => sanitize_text_field($data['city'] ?? ''),
            'postal_code'     => sanitize_text_field($data['postal_code'] ?? ''),
            'country'         => sanitize_text_field($data['country'] ?? 'BE'),
            'phone'           => sanitize_text_field($data['phone'] ?? ''),
            'email'           => sanitize_email($data['email'] ?? ''),
            'google_maps_url' => esc_url_raw($data['google_maps_url'] ?? ''),
            'hours'           => $this->sanitize_hours($data['hours'] ?? []),
        ];

        $locations[] = $new;
        update_option(self::LOCATIONS_KEY, $locations);
        return $new;
    }

    public function update_location($id, $data) {
        $locations = $this->get_locations();
        $updated = null;

        foreach ($locations as &$loc) {
            if ($loc['id'] == $id) {
                $fields = ['name', 'address', 'city', 'postal_code', 'country', 'phone'];
                foreach ($fields as $f) {
                    if (isset($data[$f])) $loc[$f] = sanitize_text_field($data[$f]);
                }
                if (isset($data['email']))           $loc['email']           = sanitize_email($data['email']);
                if (isset($data['google_maps_url']))  $loc['google_maps_url'] = esc_url_raw($data['google_maps_url']);
                if (isset($data['hours']))            $loc['hours']           = $this->sanitize_hours($data['hours']);
                $updated = $loc;
                break;
            }
        }

        if ($updated) {
            update_option(self::LOCATIONS_KEY, $locations);
        }
        return $updated;
    }

    public function delete_location($id) {
        $locations = $this->get_locations();
        $locations = array_values(array_filter($locations, function($loc) use ($id) {
            return $loc['id'] != $id;
        }));
        update_option(self::LOCATIONS_KEY, $locations);
        return true;
    }

    private function sanitize_hours($hours) {
        if (!is_array($hours)) return [];
        $days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        $clean = [];
        foreach ($days as $day) {
            if (isset($hours[$day]) && is_array($hours[$day])) {
                $clean[$day] = [
                    'open'   => sanitize_text_field($hours[$day]['open'] ?? '09:00'),
                    'close'  => sanitize_text_field($hours[$day]['close'] ?? '17:00'),
                    'closed' => !empty($hours[$day]['closed']),
                ];
            }
        }
        return $clean;
    }

    /**
     * Get business info as structured text for AI knowledge base.
     */
    public function get_knowledge_text() {
        $profile = $this->get_profile();
        $locations = $this->get_locations();

        $text = "Bedrijfsinformatie:\n";
        $text .= "Naam: {$profile['name']}\n";
        if ($profile['address']) $text .= "Adres: {$profile['address']}, {$profile['postal_code']} {$profile['city']}, {$profile['country']}\n";
        if ($profile['phone'])   $text .= "Telefoon: {$profile['phone']}\n";
        if ($profile['email'])   $text .= "E-mail: {$profile['email']}\n";
        if ($profile['website']) $text .= "Website: {$profile['website']}\n";

        foreach ($locations as $loc) {
            $text .= "\nLocatie: {$loc['name']}\n";
            $text .= "Adres: {$loc['address']}, {$loc['postal_code']} {$loc['city']}\n";
            if (!empty($loc['hours'])) {
                $text .= "Openingsuren:\n";
                $day_labels = [
                    'monday' => 'Maandag', 'tuesday' => 'Dinsdag', 'wednesday' => 'Woensdag',
                    'thursday' => 'Donderdag', 'friday' => 'Vrijdag', 'saturday' => 'Zaterdag', 'sunday' => 'Zondag',
                ];
                foreach ($loc['hours'] as $day => $h) {
                    $label = $day_labels[$day] ?? $day;
                    if (!empty($h['closed'])) {
                        $text .= "  {$label}: Gesloten\n";
                    } else {
                        $text .= "  {$label}: {$h['open']} - {$h['close']}\n";
                    }
                }
            }
        }

        return $text;
    }
}
