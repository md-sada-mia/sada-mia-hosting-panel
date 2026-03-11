<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cron_jobs', function (Blueprint $table) {
            $table->string('last_status')->nullable()->after('is_active');
            $table->longText('last_output')->nullable()->after('last_status');
        });
    }

    public function down(): void
    {
        Schema::table('cron_jobs', function (Blueprint $table) {
            $table->dropColumn(['last_status', 'last_output']);
        });
    }
};
