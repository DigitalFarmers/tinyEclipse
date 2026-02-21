<?php
/**
 * TinyEclipse Token System
 * Token-based usage: tiers, costs, deduction, monthly refill, auto-detect tier.
 */

if (!defined('ABSPATH')) exit;

class TinyEclipse_Tokens {
    private static $instance = null;

    const TIERS = [
        'free'       => ['tokens' => 50,    'price' => 0,   'label' => 'Free'],
        'pro'        => ['tokens' => 500,   'price' => 29,  'label' => 'PRO'],
        'pro+'       => ['tokens' => 2000,  'price' => 79,  'label' => 'PRO+'],
        'enterprise' => ['tokens' => 10000, 'price' => 199, 'label' => 'Enterprise'],
    ];

    const COSTS = [
        'chat'             => 1,
        'ai_chat'          => 5,
        'ai_translate'     => 8,
        'ai_job_generate'  => 10,
        'ai_custom'        => 5,
    ];

    public static function instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {}

    /**
     * Get token balance for a user.
     */
    public function get_balance($user_id = 0) {
        if (!$user_id) $user_id = get_current_user_id();
        if (!$user_id) return ['balance' => 0, 'tier' => 'free', 'lifetime_used' => 0, 'monthly_tokens' => 50];

        global $wpdb;
        $table = $wpdb->prefix . 'tinyeclipse_tokens';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) {
            return ['balance' => 0, 'tier' => 'free', 'lifetime_used' => 0, 'monthly_tokens' => 50];
        }

        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE user_id = %d", $user_id));

        if (!$row) {
            // Auto-detect and initialize
            $tier = $this->auto_detect_tier($user_id);
            $tokens = self::TIERS[$tier]['tokens'];
            $this->initialize_user($user_id, $tier, $tokens);
            return ['balance' => $tokens, 'tier' => $tier, 'lifetime_used' => 0, 'monthly_tokens' => $tokens];
        }

        // Check monthly reset
        $this->maybe_monthly_reset($user_id, $row);

        // Re-fetch after potential reset
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE user_id = %d", $user_id));

        return [
            'balance'        => (int)$row->balance,
            'tier'           => $row->tier,
            'lifetime_used'  => (int)$row->lifetime_used,
            'monthly_tokens' => self::TIERS[$row->tier]['tokens'] ?? 50,
            'monthly_reset'  => $row->monthly_reset,
            'tier_label'     => self::TIERS[$row->tier]['label'] ?? 'Free',
        ];
    }

    /**
     * Deduct tokens for an action.
     */
    public function deduct($action, $user_id = 0) {
        if (!$user_id) $user_id = get_current_user_id();
        if (!$user_id) return new WP_Error('no_user', 'No user');

        // Superadmins (enterprise) are exempt
        if ($this->is_exempt($user_id)) {
            return ['deducted' => 0, 'balance' => 99999, 'exempt' => true, 'action' => $action];
        }

        $costs = apply_filters('tinyeclipse_token_costs', self::COSTS);
        $cost = $costs[$action] ?? 1;

        $balance = $this->get_balance($user_id);
        if ($balance['balance'] < $cost) {
            return new WP_Error('insufficient_tokens', 'Onvoldoende tokens', [
                'required' => $cost, 'balance' => $balance['balance'], 'tier' => $balance['tier'],
            ]);
        }

        global $wpdb;
        $table = $wpdb->prefix . 'tinyeclipse_tokens';
        $wpdb->query($wpdb->prepare(
            "UPDATE {$table} SET balance = balance - %d, lifetime_used = lifetime_used + %d WHERE user_id = %d",
            $cost, $cost, $user_id
        ));

        $new_balance = $balance['balance'] - $cost;

        // Log
        $log_table = $wpdb->prefix . 'tinyeclipse_token_log';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$log_table}'") === $log_table) {
            $wpdb->insert($log_table, [
                'user_id'       => $user_id,
                'action'        => $action,
                'tokens_used'   => $cost,
                'balance_after' => $new_balance,
                'description'   => "Token deduction: {$action} (-{$cost})",
                'created_at'    => current_time('mysql'),
            ]);
        }

        do_action('tinyeclipse_token_deducted', $user_id, $action, $cost, $new_balance);

        return [
            'deducted' => $cost,
            'balance'  => $new_balance,
            'action'   => $action,
            'tier'     => $balance['tier'],
        ];
    }

    /**
     * Check if user can afford an action.
     */
    public function can_afford($action, $user_id = 0) {
        if (!$user_id) $user_id = get_current_user_id();
        if ($this->is_exempt($user_id)) return true;

        $costs = apply_filters('tinyeclipse_token_costs', self::COSTS);
        $cost = $costs[$action] ?? 1;
        $balance = $this->get_balance($user_id);

        return $balance['balance'] >= $cost;
    }

    /**
     * Auto-detect tier based on user email and role.
     */
    private function auto_detect_tier($user_id) {
        $user = get_user_by('ID', $user_id);
        if (!$user) return 'free';

        $email = $user->user_email;

        // Digital Farmers / TinyEclipse staff → enterprise
        $staff_domains = ['@digitalfarmers.be', '@digitalfarmers.nl', '@tinyeclipse.'];
        foreach ($staff_domains as $d) {
            if (strpos($email, $d) !== false) return 'enterprise';
        }

        // Administrator → pro+
        if ($user->has_cap('manage_options')) return 'pro+';

        // Shop manager → pro
        if (in_array('shop_manager', $user->roles) || $user->has_cap('manage_woocommerce')) return 'pro';

        return 'free';
    }

    /**
     * Check if user is exempt from token deductions (enterprise/superadmin).
     */
    private function is_exempt($user_id) {
        $user = get_user_by('ID', $user_id);
        if (!$user) return false;

        $email = $user->user_email;
        $staff_domains = ['@digitalfarmers.be', '@digitalfarmers.nl', '@tinyeclipse.'];
        foreach ($staff_domains as $d) {
            if (strpos($email, $d) !== false) return true;
        }

        // Check if tier is enterprise
        global $wpdb;
        $table = $wpdb->prefix . 'tinyeclipse_tokens';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) return false;

        $tier = $wpdb->get_var($wpdb->prepare("SELECT tier FROM {$table} WHERE user_id = %d", $user_id));
        return $tier === 'enterprise';
    }

    /**
     * Initialize a new user's token record.
     */
    private function initialize_user($user_id, $tier, $tokens) {
        global $wpdb;
        $table = $wpdb->prefix . 'tinyeclipse_tokens';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) return;

        $wpdb->replace($table, [
            'user_id'       => $user_id,
            'balance'       => $tokens,
            'lifetime_used' => 0,
            'tier'          => $tier,
            'monthly_reset' => date('Y-m-01', strtotime('+1 month')),
        ]);
    }

    /**
     * Check and perform monthly token reset.
     */
    private function maybe_monthly_reset($user_id, $row) {
        if (empty($row->monthly_reset)) return;
        if (date('Y-m-d') < $row->monthly_reset) return;

        $tier = $row->tier;
        $monthly_tokens = self::TIERS[$tier]['tokens'] ?? 50;

        global $wpdb;
        $table = $wpdb->prefix . 'tinyeclipse_tokens';
        $wpdb->update($table, [
            'balance'       => $monthly_tokens,
            'monthly_reset' => date('Y-m-01', strtotime('+1 month')),
        ], ['user_id' => $user_id]);

        tinyeclipse_log('tokens', 'info', "Monthly reset for user {$user_id}: {$monthly_tokens} tokens ({$tier})", [
            'user_id' => $user_id, 'tier' => $tier, 'tokens' => $monthly_tokens,
        ]);
    }

    /**
     * Set tier for a user (superadmin action).
     */
    public function set_tier($user_id, $tier) {
        if (!isset(self::TIERS[$tier])) return new WP_Error('invalid_tier', 'Invalid tier');

        global $wpdb;
        $table = $wpdb->prefix . 'tinyeclipse_tokens';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) return new WP_Error('no_table', 'Token table not found');

        $exists = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$table} WHERE user_id = %d", $user_id));
        $tokens = self::TIERS[$tier]['tokens'];

        if ($exists) {
            $wpdb->update($table, ['tier' => $tier, 'balance' => $tokens], ['user_id' => $user_id]);
        } else {
            $this->initialize_user($user_id, $tier, $tokens);
        }

        tinyeclipse_log('tokens', 'info', "Tier set to {$tier} for user {$user_id}", ['tokens' => $tokens]);
        return ['status' => 'updated', 'user_id' => $user_id, 'tier' => $tier, 'balance' => $tokens];
    }

    /**
     * Top up tokens for a user.
     */
    public function top_up($user_id, $amount) {
        global $wpdb;
        $table = $wpdb->prefix . 'tinyeclipse_tokens';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) return new WP_Error('no_table', 'Token table not found');

        $wpdb->query($wpdb->prepare("UPDATE {$table} SET balance = balance + %d WHERE user_id = %d", (int)$amount, $user_id));

        $new_balance = $wpdb->get_var($wpdb->prepare("SELECT balance FROM {$table} WHERE user_id = %d", $user_id));

        // Log
        $log_table = $wpdb->prefix . 'tinyeclipse_token_log';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$log_table}'") === $log_table) {
            $wpdb->insert($log_table, [
                'user_id'       => $user_id,
                'action'        => 'top_up',
                'tokens_used'   => -(int)$amount,
                'balance_after' => (int)$new_balance,
                'description'   => "Top-up: +{$amount} tokens",
                'created_at'    => current_time('mysql'),
            ]);
        }

        return ['status' => 'topped_up', 'user_id' => $user_id, 'added' => (int)$amount, 'balance' => (int)$new_balance];
    }

    /**
     * Get usage log for a user.
     */
    public function get_usage($user_id, $limit = 50) {
        global $wpdb;
        $table = $wpdb->prefix . 'tinyeclipse_token_log';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) return [];

        return $wpdb->get_results($wpdb->prepare(
            "SELECT action, tokens_used, balance_after, description, created_at FROM {$table} WHERE user_id = %d ORDER BY id DESC LIMIT %d",
            $user_id, $limit
        ), ARRAY_A);
    }

    /**
     * Get all user balances (superadmin).
     */
    public function get_all_balances() {
        global $wpdb;
        $table = $wpdb->prefix . 'tinyeclipse_tokens';
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) return [];

        $rows = $wpdb->get_results("SELECT t.*, u.user_email, u.display_name FROM {$table} t JOIN {$wpdb->users} u ON u.ID = t.user_id ORDER BY t.balance DESC");

        $result = [];
        foreach ($rows as $row) {
            $result[] = [
                'user_id'       => (int)$row->user_id,
                'email'         => $row->user_email,
                'name'          => $row->display_name,
                'balance'       => (int)$row->balance,
                'tier'          => $row->tier,
                'lifetime_used' => (int)$row->lifetime_used,
                'monthly_reset' => $row->monthly_reset,
            ];
        }
        return $result;
    }
}
