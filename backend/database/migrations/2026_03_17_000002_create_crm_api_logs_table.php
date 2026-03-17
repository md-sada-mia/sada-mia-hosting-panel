<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('crm_api_logs', function (Blueprint $blueprint) {
            $blueprint->id();
            $blueprint->foreignId('customer_id')->constrained()->onDelete('cascade');
            $blueprint->string('url');
            $blueprint->string('method');
            $blueprint->text('payload')->nullable();
            $blueprint->text('response')->nullable();
            $blueprint->integer('status_code')->nullable();
            $blueprint->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('crm_api_logs');
    }
};
