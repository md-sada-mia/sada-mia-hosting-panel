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
        Schema::table('customer_deployments', function (Blueprint $table) {
            if (!Schema::hasColumn('customer_deployments', 'started_at')) {
                $table->timestamp('started_at')->nullable()->after('log_output');
            }
            if (!Schema::hasColumn('customer_deployments', 'finished_at')) {
                $table->timestamp('finished_at')->nullable()->after('started_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customer_deployments', function (Blueprint $table) {
            $table->dropColumn(['started_at', 'finished_at']);
        });
    }
};
