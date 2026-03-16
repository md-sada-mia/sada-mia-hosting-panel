<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('app_id')->constrained()->cascadeOnDelete();
            $table->string('name');               // e.g. "Queue Worker"
            $table->string('slug')->nullable();   // e.g. "queue-worker" (used as systemd unit / pm2 name suffix)
            $table->enum('type', ['php-worker', 'node-worker', 'custom'])->default('custom');
            $table->text('command')->nullable();  // Full shell command, e.g. "php artisan queue:work"
            $table->text('description')->nullable();
            $table->boolean('recommended')->default(false); // Was auto-suggested at install time?
            $table->boolean('enabled')->default(true);
            $table->enum('status', ['running', 'stopped', 'failed', 'unknown'])->default('unknown');
            $table->timestamp('started_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_services');
    }
};
