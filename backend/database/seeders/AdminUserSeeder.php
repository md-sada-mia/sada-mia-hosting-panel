<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $email    = config('hosting.admin_email', 'admin@panel.local');
        $password = config('hosting.admin_password', 'admin');

        User::updateOrCreate(
            ['email' => $email],
            [
                'name'     => 'Admin',
                'email'    => $email,
                'password' => Hash::make($password),
            ]
        );

        $this->command->info("Admin user ready: {$email}");
    }
}
