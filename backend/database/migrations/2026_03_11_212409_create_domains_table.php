<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('domains', function (Blueprint $table) {
            $table->id();
            $table->foreignId('app_id')->nullable()->constrained('apps')->nullOnDelete();
            $table->string('domain')->unique();
            $table->string('nameserver_1')->nullable();
            $table->string('nameserver_2')->nullable();
            $table->string('nameserver_3')->nullable();
            $table->string('nameserver_4')->nullable();
            $table->enum('status', ['active', 'pending', 'inactive'])->default('pending');
            $table->boolean('dns_managed')->default(false); // Whether BIND9 manages this zone
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domains');
    }
};
