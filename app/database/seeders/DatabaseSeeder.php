<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['email' => 'yuryg@gethydrosight.com.au'],
            [
                'name' => 'Yury',
                'password' => 'GEAR.smith6',
                'email_verified_at' => now(),
            ]
        );
    }
}
