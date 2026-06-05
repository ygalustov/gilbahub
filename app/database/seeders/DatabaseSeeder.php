<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
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
                'password_hash' => Hash::make('GEAR.smith6'),
                'status' => 'active',
                'is_admin' => true,
            ]
        );

        $account = Account::query()->updateOrCreate(
            ['owner_user_id' => $user->id],
            [
                'display_name' => 'Yury',
                'country' => 'AU',
                'region' => '',
                'methodology' => 'mlsn',
                'soil_texture' => 'loam',
                'created_by_user_id' => $user->id,
                'modified_by_user_id' => $user->id,
            ]
        );

        $site = Site::query()->updateOrCreate(
            [
                'account_id' => $account->id,
                'name' => 'Default Site',
            ],
            [
                'slug' => Str::slug('Default Site'),
                'site_type' => 'precinct',
                'timezone' => 'Australia/Sydney',
                'created_by_user_id' => $user->id,
                'modified_by_user_id' => $user->id,
            ]
        );

        $site->users()->syncWithoutDetaching([
            $user->id => ['role' => 'owner'],
        ]);

        $user->forceFill(['last_active_site_id' => $site->id])->save();

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
