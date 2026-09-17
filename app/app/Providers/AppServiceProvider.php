<?php

namespace App\Providers;

use App\Models\Site;
use App\Models\SiteConfig;
use App\Models\User;
use App\Services\SpeciesService;
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

        View::composer('*', function ($view) {
            try {
                $view->with('speciesData', app(SpeciesService::class)->getSpeciesByType());
            } catch (\Throwable) {
                $view->with('speciesData', []);
            }
        });

        // GH-441 (GH-439 stage 2): every db-shell page gets the active site's
        // stored config and wizard record, the same way /hub has always had
        // them.
        //
        // Without this, the pages that run the legacy engine (Reports, the
        // morning briefing, the stadium view) started with no configuration at
        // all and filled the gap from localStorage: the setup wizard decided
        // whether to appear by reading `gilba_wizard_complete` in the browser,
        // so a clean browser showed it on a site that had completed it, and
        // location-preloader.js wrote coordinates from the same copy over the
        // server's own.
        View::composer('layouts.db-shell', function ($view) {
            $activeSite = Auth::check() ? Auth::user()?->activeSite : null;

            $gaipConfig = [];
            if ($activeSite) {
                $record = $activeSite->configs()->where('namespace', 'gaip')->first();
                $gaipConfig = is_array($record?->config) ? $record->config : [];
            }

            $wizardState = is_array($gaipConfig['wizard'] ?? null) ? $gaipConfig['wizard'] : [];

            $view->with([
                'injectedGaipConfig' => $gaipConfig,
                'injectedWizardState' => $wizardState,
                // GH-450: a wizard deliberately skipped is a wizard that has
                // been answered. The record can say `complete` or `skipped`
                // (site-setup-wizard.js writes the second when the user
                // dismisses it), and the client code has always read both --
                // but only after a save, never on load. The injected flag read
                // `complete` alone, which no one noticed while the
                // localStorage profile gate was still suppressing the overlay.
                // GH-439 stage 4b removes that gate, so this is the answer.
                'injectedWizardAnswered' => (bool) (($wizardState['complete'] ?? false) || ($wizardState['skipped'] ?? false)),
                'injectedSavedLocation' => [
                    'name' => $activeSite?->location_name ?? '',
                    'lat' => $activeSite?->latitude ?? '',
                    'lon' => $activeSite?->longitude ?? '',
                ],
            ]);
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
                    $gp = (float) $gpRaw >= 1 ? (float) $gpRaw : (float) $gpRaw * 100;
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
