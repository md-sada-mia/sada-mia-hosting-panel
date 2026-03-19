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
        Schema::table('apps', function (Blueprint $table) {
            $table->text('env_vars')->nullable();
        });

        // Migrate existing data
        if (Schema::hasTable('env_variables')) {
            $apps = \Illuminate\Support\Facades\DB::table('apps')->get();
            foreach ($apps as $app) {
                $vars = \Illuminate\Support\Facades\DB::table('env_variables')
                    ->where('app_id', $app->id)
                    ->get();

                if ($vars->isNotEmpty()) {
                    $envString = $vars->map(fn($v) => "{$v->key}={$v->value}")->join("\n");
                    \Illuminate\Support\Facades\DB::table('apps')
                        ->where('id', $app->id)
                        ->update(['env_vars' => $envString]);
                }
            }

            Schema::dropIfExists('env_variables');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('env_variables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('app_id')->constrained()->cascadeOnDelete();
            $table->string('key');
            $table->text('value')->nullable();
            $table->timestamps();
            $table->unique(['app_id', 'key']);
        });

        // Restore data
        $apps = \Illuminate\Support\Facades\DB::table('apps')->get();
        foreach ($apps as $app) {
            if ($app->env_vars) {
                $lines = explode("\n", $app->env_vars);
                foreach ($lines as $line) {
                    if (str_contains($line, '=')) {
                        [$key, $value] = explode('=', $line, 2);
                        \Illuminate\Support\Facades\DB::table('env_variables')->insert([
                            'app_id'     => $app->id,
                            'key'        => trim($key),
                            'value'      => trim($value),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            }
        }

        Schema::table('apps', function (Blueprint $table) {
            $table->dropColumn('env_vars');
        });
    }
};
