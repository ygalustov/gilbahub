<?php

namespace App\Providers;

use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        // Admin bypasses all Gate checks
        Gate::before(function (User $user) {
            if ($user->is_admin) {
                return true;
            }
        });

        if (config('app.force_https')) {
            URL::forceScheme('https');
            URL::forceRootUrl((string) config('app.url'));
        }

        View::share('legacyAssetUrl', function (string $asset): string {
            $path = base_path('../assets/'.$asset);
            $version = is_file($path) ? '?v='.filemtime($path) : '';
            return url('/legacy-assets/'.$asset).$version;
        });

        View::composer('partials.topbar', function ($view) {
            if (! Auth::check()) {
                $view->with('siteStatusMap', []);
                return;
            }

            $user = Auth::user();
            $siteIds = $user->is_admin
                ? Site::pluck('id')
                : $user->sites()->pluck('sites.id');

            $caches = SiteConfig::whereIn('site_id', $siteIds)
                ->where('namespace', 'analysis_cache')
                ->get()
                ->keyBy('site_id');

            $statusMap = [];
            foreach ($siteIds as $siteId) {
                $config = is_array($caches->get($siteId)?->config) ? $caches->get($siteId)->config : [];
                $gpRaw  = $config['metrics']['growthPotential'] ?? null;
                if ($gpRaw !== null) {
                    $gp = (float) $gpRaw > 1 ? (float) $gpRaw : (float) $gpRaw * 100;
                    $statusMap[$siteId] = $gp >= 70 ? 'green' : ($gp >= 40 ? 'amber' : 'red');
                } else {
                    $statusMap[$siteId] = null;
                }
            }

            $view->with('siteStatusMap', $statusMap);
        });
    }
}
