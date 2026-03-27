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
        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->boolean('is_public')->default(true)->after('is_active');
        });

        Schema::create('plan_domain_visibility', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_id')->constrained('subscription_plans')->cascadeOnDelete();
            $table->string('domain')->index();
            $table->timestamps();

            $table->unique(['plan_id', 'domain']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('plan_domain_visibility');
        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->dropColumn('is_public');
        });
    }
};
