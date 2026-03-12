<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class GitHubSettingsSeeder extends Seeder
{
    public function run(): void
    {
        Setting::set('github_client_id', 'Ov23li0xAUkEHm9IiqLI');
        Setting::set('github_client_secret', 'c984622cc450cc395a08569d5cf637c307d3c091');

        // Also set a default webhook secret if not already set
        if (!Setting::get('github_webhook_secret')) {
            Setting::set('github_webhook_secret', bin2hex(random_bytes(16)));
        }
    }
}
