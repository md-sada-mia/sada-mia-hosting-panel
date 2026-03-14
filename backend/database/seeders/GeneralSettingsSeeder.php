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
    }
}
