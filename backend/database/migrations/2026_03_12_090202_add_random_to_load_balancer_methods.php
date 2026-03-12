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
        Schema::table('load_balancers', function (Blueprint $table) {
            $table->enum('method', ['round_robin', 'least_conn', 'ip_hash', 'random'])
                ->default('round_robin')
                ->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('load_balancers', function (Blueprint $table) {
            $table->enum('method', ['round_robin', 'least_conn', 'ip_hash'])
                ->default('round_robin')
                ->change();
        });
    }
};
