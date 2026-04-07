<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('users')->insertOrIgnore([
            'name'       => 'Admin',
            'email'      => 'admin@svapro.it',
            'password'   => Hash::make('password123'),
            'status'     => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
