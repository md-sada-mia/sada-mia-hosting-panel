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
        Schema::table('apps', function (Blueprint $table) {
            $table->string('ssl_status')->default('none'); // none, pending, active, failed
            $table->boolean('ssl_enabled')->default(false);
            $table->timestamp('ssl_last_check_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('apps', function (Blueprint $table) {
            $table->dropColumn(['ssl_status', 'ssl_enabled', 'ssl_last_check_at']);
        });
    }
};
