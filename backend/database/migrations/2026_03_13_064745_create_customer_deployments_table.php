<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('customer_deployments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->string('resource_type')->nullable(); // 'app' or 'load_balancer'
            $table->unsignedBigInteger('app_id')->nullable();
            $table->unsignedBigInteger('load_balancer_id')->nullable();
            $table->string('domain_mode')->nullable(); // 'subdomain' or 'custom'
            $table->string('domain')->nullable();
            $table->string('subdomain')->nullable();
            $table->string('app_type')->nullable(); // 'nextjs', 'laravel', 'static'
            $table->boolean('existing_app')->default(false);
            $table->string('git_url')->nullable();
            $table->string('branch')->nullable();
            $table->string('github_full_name')->nullable();
            $table->string('github_id')->nullable();
            $table->boolean('auto_deploy')->default(false);
            $table->text('env_vars')->nullable();
            $table->boolean('auto_db_create')->default(false);
            $table->string('db_name')->nullable();
            $table->string('db_user')->nullable();
            $table->string('db_password')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_deployments');
    }
};
