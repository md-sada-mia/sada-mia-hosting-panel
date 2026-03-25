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
        Schema::table('database_users', function (Blueprint $table) {
            $table->json('global_privileges')->nullable(); // e.g. ["CREATEDB", "CREATEROLE", "SUPERUSER"]
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('database_users', function (Blueprint $table) {
            $table->dropColumn('global_privileges');
        });
    }
};
