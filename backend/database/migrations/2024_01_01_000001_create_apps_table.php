<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('apps', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->enum('type', ['nextjs', 'laravel', 'static']);
            $table->string('domain')->unique();
            $table->string('git_url');
            $table->string('branch')->default('main');
            $table->string('deploy_path')->nullable();
            $table->unsignedSmallInteger('port')->nullable();
            $table->enum('status', ['idle', 'deploying', 'running', 'stopped', 'error'])->default('idle');
            $table->string('php_version')->default('8.4');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('apps');
    }
};
