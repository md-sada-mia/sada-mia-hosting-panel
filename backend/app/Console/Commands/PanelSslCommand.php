<?php

namespace App\Console\Commands;

use App\Services\SslService;
use Illuminate\Console\Command;

class PanelSslCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:panel-ssl {domain}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Secure the hosting panel port (8083) using an existing domain certificate';

    /**
     * Execute the console command.
     */
    public function handle(SslService $sslService)
    {
        $domain = $this->argument('domain');

        $this->info("Attempting to secure panel with SSL for domain: {$domain}...");

        $result = $sslService->securePanel($domain);

        if ($result['success']) {
            $this->info($result['message']);
            $this->info("You should now be able to access the panel at https://{$domain}:8083");
        } else {
            $this->error($result['message']);
            return 1;
        }

        return 0;
    }
}
