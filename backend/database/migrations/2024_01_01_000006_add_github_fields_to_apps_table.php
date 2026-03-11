<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('apps', function (Blueprint $table) {
            $table->string('github_full_name')->nullable();
            $table->unsignedBigInteger('github_id')->nullable();
            $table->string('webhook_secret')->nullable();
            $table->boolean('auto_deploy')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('apps', function (Blueprint $table) {
            $table->dropColumn(['github_full_name', 'github_id', 'webhook_secret', 'auto_deploy']);
        });
    }
};
