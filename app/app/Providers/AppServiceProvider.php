<?php

namespace App\Providers;

use App\Support\AnalysisResults;
use App\Models\Site;
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

            // GH-546 (stage 1): through the owner of the result. This
            // composer runs on every page carrying a topbar, so it reads many
            // sites at once — `forSites` keeps that one query — and the growth
            // potential thresholds (70 / 40) live with the result rather than as
            // a second copy here.
            $statusMap = AnalysisResults::statusMap($siteIds);

            $view->with('siteStatusMap', $statusMap);

            // Always inject topbar data from DB so all pages (incl. Route::view) have it
            $activeSite = $user->activeSite;
            $allSites   = $user->is_admin
                ? Site::query()->orderBy('name')->get()
                : ($user->sites()->orderBy('name')->get() ?? collect());

            $turfSpecies     = null;
            $turfMethodology = null;
            $locationName    = null;
            $analysisResult  = null;

            if ($activeSite) {
                $gaipRecord = $activeSite->configs()->where('namespace', 'gaip')->first();
                $gaipConfig = is_array($gaipRecord?->config) ? $gaipRecord->config : [];

                $turfSpecies     = $gaipConfig['turf']['species'] ?? null;
                $turfMethodology = isset($gaipConfig['turf']['methodology'])
                    ? strtoupper($gaipConfig['turf']['methodology'])
                    : null;
                $locationName    = $gaipConfig['location']['name'] ?? $activeSite->location_name ?: null;

                // GH-546 (stage 1): the date of the numbers comes from the
                // same projection as the numbers. `$caches` — the hand-built
                // query that stood above — is gone with the hand-built status
                // map; this is the only other thing that read it.
                //
                // GH-548 (stage 3): the projection itself travels, not a
                // formatted date pulled out of it. The pill has to say whether
                // the last re-run failed as well as when the numbers are from,
                // and that is `AnalysisNotice`'s job in one place rather than a
                // second date format here.
                $analysisResult = AnalysisResults::forSite($activeSite);
            }

            $view->with([
                'activeSite'      => $activeSite,
                'allSites'        => $allSites,
                'turfSpecies'     => $turfSpecies,
                'turfMethodology' => $turfMethodology,
                'locationName'    => $locationName,
                'analysisCache'   => $analysisResult,
            ]);
        });
    }
}
