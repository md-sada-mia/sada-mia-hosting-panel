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
        Schema::table('database_database_user', function (Blueprint $table) {
            $table->string('privileges')->default('read'); // 'read', 'write', 'all'
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('database_database_user', function (Blueprint $table) {
            $table->dropColumn('privileges');
        });
    }
};
