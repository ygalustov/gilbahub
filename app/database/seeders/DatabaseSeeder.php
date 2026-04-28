<?php

namespace Database\Seeders;

use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $user = User::query()->updateOrCreate(
            ['email' => 'yuryg@gethydrosight.com.au'],
            [
                'name' => 'Yury',
                'password' => 'GEAR.smith6',
                'email_verified_at' => now(),
            ]
        );

        $site = Site::query()->updateOrCreate(
            [
                'owner_user_id' => $user->id,
                'name' => 'Default Site',
            ],
            [
                'slug' => Str::slug('Default Site'),
                'timezone' => 'Australia/Sydney',
            ]
        );

        $site->users()->syncWithoutDetaching([
            $user->id => ['role' => 'owner'],
        ]);

        SiteConfig::query()->updateOrCreate(
            [
                'site_id' => $site->id,
                'namespace' => 'gaip',
            ],
            [
                'config' => [
                    'source' => 'seed',
                    'status' => 'ready_for_wp_liftout',
                ],
                'synced_at' => now(),
            ]
        );
    }
}
