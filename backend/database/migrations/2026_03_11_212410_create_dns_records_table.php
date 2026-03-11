<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dns_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('domain_id')->constrained('domains')->cascadeOnDelete();
            $table->enum('type', ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'PTR', 'CAA'])->default('A');
            $table->string('name'); // subdomain or @ for root
            $table->text('value');  // IP, hostname, or TXT content
            $table->unsignedInteger('ttl')->default(3600);
            $table->unsignedSmallInteger('priority')->nullable(); // For MX, SRV
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dns_records');
    }
};
