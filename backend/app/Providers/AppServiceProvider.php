<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('settings')) {
                $panelUrl = \App\Models\Setting::get('panel_url');
                if ($panelUrl) {
                    config(['app.url' => $panelUrl]);
                }
            }
        } catch (\Exception $e) {
            // Database might not be migrated yet
        }
    }
}
