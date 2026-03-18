<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class GitHubSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $clientId = 'Ov23li0xAUkEHm9IiqLI';
        $clientSecret = 'c984622cc450cc395a08569d5cf637c307d3c091';

        if (app()->environment('local')) {
            $clientId = 'Ov23linzcu0DbK7Q2uq5';
            $clientSecret = '9d14365769cf82ee81636d6b14afe6a2bc809d49';
        }

        Setting::set('github_client_id', $clientId);
        Setting::set('github_client_secret', $clientSecret);

        // Also set a default webhook secret if not already set
        if (!Setting::get('github_webhook_secret')) {
            Setting::set('github_webhook_secret', bin2hex(random_bytes(16)));
        }
    }
}
