<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cron_jobs', function (Blueprint $row) {
            $row->id();
            $row->string('command');
            $row->string('schedule');
            $row->string('description')->nullable();
            $row->boolean('is_active')->default(true);
            $row->timestamp('last_run_at')->nullable();
            $row->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cron_jobs');
    }
};
