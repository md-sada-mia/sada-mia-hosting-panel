<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->string('domain')->nullable()->index()->after('id');
            $table->foreignId('user_id')->nullable()->change();
        });

        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->string('domain')->nullable()->index()->after('id');
            $table->foreignId('user_id')->nullable()->change();
        });

        Schema::table('request_usage_logs', function (Blueprint $table) {
            $table->string('domain')->nullable()->index()->after('id');
            $table->foreignId('user_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn('domain');
            $table->foreignId('user_id')->nullable(false)->change();
        });

        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->dropColumn('domain');
            $table->foreignId('user_id')->nullable(false)->change();
        });

        Schema::table('request_usage_logs', function (Blueprint $table) {
            $table->dropColumn('domain');
            $table->foreignId('user_id')->nullable(false)->change();
        });
    }
};
