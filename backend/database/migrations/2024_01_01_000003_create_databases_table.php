<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('databases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('app_id')->nullable()->constrained()->nullOnDelete();
            $table->string('db_name')->unique();
            $table->string('db_user')->unique();
            $table->string('db_password');
            $table->enum('status', ['active', 'error'])->default('active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('databases');
    }
};
