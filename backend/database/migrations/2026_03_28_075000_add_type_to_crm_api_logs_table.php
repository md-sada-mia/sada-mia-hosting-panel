<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        if (!Schema::hasColumn('crm_api_logs', 'type')) {
            Schema::table('crm_api_logs', function (Blueprint $table) {
                $table->string('type')->default('request')->after('customer_id');
            });
        }
    }

    public function down()
    {
        Schema::table('crm_api_logs', function (Blueprint $table) {
            $table->dropColumn('type');
        });
    }
};
