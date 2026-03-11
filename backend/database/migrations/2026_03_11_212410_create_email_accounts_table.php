<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('email_domain_id')->constrained('email_domains')->cascadeOnDelete();
            $table->string('username'); // local part only (before the @)
            $table->string('password_hash'); // dovecot-compatible hash
            $table->unsignedInteger('quota_mb')->default(500);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['email_domain_id', 'username']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_accounts');
    }
};
