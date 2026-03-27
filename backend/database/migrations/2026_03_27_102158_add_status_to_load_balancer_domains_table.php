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
        Schema::table('load_balancer_domains', function (Blueprint $table) {
            $table->string('status')->default('active'); // active, deactivated
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('load_balancer_domains', function (Blueprint $table) {
            //
        });
    }
};
