<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Database\Seeders\SpeciesDefinitionSeeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(SpeciesDefinitionSeeder::class);

        $user = User::query()->updateOrCreate(
            ['email' => 'yuryg@gethydrosight.com.au'],
            [
                'name' => 'Yury',
                'status' => 'active',
                'is_admin' => true,
            ]
        );

        User::query()->updateOrCreate(
            ['email' => 'herbycides@gmail.com'],
            [
                'name' => 'Admin',
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
            // GH-365: 'owner' was retired as a site_user.role value by the RBAC
            // migration (2026_06_04_000000_add_rbac_and_auth_tables.php, which
            // bulk-converts existing 'owner' rows to 'manager'); User::canEdit
            // Site()/canManageSite() do not recognise it, so a seeded non-admin
            // user would silently 403 on their own site.
            $user->id => ['role' => 'manager'],
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
