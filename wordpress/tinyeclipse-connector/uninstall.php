<?php
/**
 * TinyEclipse Connector — Uninstall
 * Removes all plugin options when the plugin is deleted (not deactivated).
 */
if (!defined('WP_UNINSTALL_PLUGIN')) exit;

delete_option('tinyeclipse_tenant_id');
delete_option('tinyeclipse_enabled');
delete_option('tinyeclipse_color');
delete_option('tinyeclipse_name');
delete_option('tinyeclipse_lang');
delete_option('tinyeclipse_position');
delete_option('tinyeclipse_exclude_pages');
delete_option('tinyeclipse_exclude_roles');
