<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_aliases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('email_domain_id')->constrained('email_domains')->cascadeOnDelete();
            $table->string('source');      // local part (before @)
            $table->string('destination'); // full email address
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['email_domain_id', 'source']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_aliases');
    }
};
