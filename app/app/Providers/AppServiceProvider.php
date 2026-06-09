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

        View::composer('partials.sidebar', function ($view) {
            if (! Auth::check()) {
                $view->with('pendingRequestsCount', 0);
                return;
            }
            $user = Auth::user();
            $count = $user->is_admin
                ? User::where('status', 'pending')->count()
                : 0;
            $view->with('pendingRequestsCount', $count);
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

            // Always inject topbar data from DB so all pages (incl. Route::view) have it
            $activeSite = $user->activeSite;
            $allSites   = $user->is_admin
                ? Site::query()->orderBy('name')->get()
                : ($user->sites()->orderBy('name')->get() ?? collect());

            $turfSpecies     = null;
            $turfMethodology = null;
            $locationName    = null;
            $analysisTs      = null;

            if ($activeSite) {
                $gaipRecord = $activeSite->configs()->where('namespace', 'gaip')->first();
                $gaipConfig = is_array($gaipRecord?->config) ? $gaipRecord->config : [];

                $turfSpecies     = $gaipConfig['turf']['species'] ?? null;
                $turfMethodology = isset($gaipConfig['turf']['methodology'])
                    ? strtoupper($gaipConfig['turf']['methodology'])
                    : null;
                $locationName    = $gaipConfig['location']['name'] ?? $activeSite->location_name ?: null;

                $cacheRecord = $caches->get($activeSite->id);
                if ($cacheRecord?->synced_at) {
                    $tz = $activeSite->timezone ?: 'UTC';
                    $analysisTs = $cacheRecord->synced_at->setTimezone($tz)->format('M j H:i');
                }
            }

            $view->with([
                'activeSite'      => $activeSite,
                'allSites'        => $allSites,
                'turfSpecies'     => $turfSpecies,
                'turfMethodology' => $turfMethodology,
                'locationName'    => $locationName,
                'analysisTs'      => $analysisTs,
            ]);
        });
    }
}
