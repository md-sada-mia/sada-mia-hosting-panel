<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class GeneralSettingsSeeder extends Seeder
{
    public function run(): void
    {
        // Default server IP from environment if not already set in DB
        if (!Setting::get('server_ip')) {
            Setting::set('server_ip', env('SERVER_IP', '127.0.0.1'));
        }

        Setting::set('panel_url', config('app.url'));

        // CRM Settings
        if (!Setting::get('crm_creation_type')) {
            Setting::set('crm_creation_type', 'load_balancer');
        }

        // Support Contact Settings
        if (!Setting::get('support_email')) {
            Setting::set('support_email', 'support@sadamiahosing.com');
        }
        if (!Setting::get('support_whatsapp')) {
            Setting::set('support_whatsapp', '+8801700000000');
        }
        if (!Setting::get('support_facebook')) {
            Setting::set('support_facebook', 'https://facebook.com/sadamiahosing');
        }
        if (!Setting::get('support_mobile')) {
            Setting::set('support_mobile', '01700000000');
        }
    }
}
