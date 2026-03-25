<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('database_database_user', function (Blueprint $table) {
            $table->foreignId('database_id')->constrained()->cascadeOnDelete();
            $table->foreignId('database_user_id')->constrained()->cascadeOnDelete();
            $table->primary(['database_id', 'database_user_id'], 'db_db_user_primary');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('database_database_user');
    }
};
