<?php

namespace App\Http\Controllers;

use App\Models\Sample;
use App\Models\Site;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function show(Request $request): View|RedirectResponse
    {
        $user       = $request->user()?->fresh();
        $activeSite = $user?->activeSite;

        $allSites = $user?->is_admin
            ? Site::query()->orderBy('name')->get()
            : ($user?->sites()->orderBy('name')->get() ?? collect());

        // Non-admin with no sites → no access page
        if (! $user?->is_admin && $allSites->isEmpty()) {
            return redirect()->route('no-access');
        }

        $savedLocation = [
            'name' => $activeSite?->location_name ?? '',
            'lat'  => $activeSite?->latitude ?? '',
            'lon'  => $activeSite?->longitude ?? '',
        ];

        // Gaip config — species, methodology, location region
        $gaipConfig      = [];
        $turfSpecies     = null;
        $turfMethodology = null;
        $locationName    = null;

        if ($activeSite) {
            $gaipRecord = $activeSite->configs()->where('namespace', 'gaip')->first();
            $gaipConfig = is_array($gaipRecord?->config) ? $gaipRecord->config : [];

            $turfSpecies     = $gaipConfig['turf']['species'] ?? null;
            $turfMethodology = strtoupper(self::effectiveMethodology(
                $gaipConfig['turf']['methodology'] ?? null,
                $activeSite->latitude  !== null ? (float) $activeSite->latitude  : null,
                $activeSite->longitude !== null ? (float) $activeSite->longitude : null,
            ));
            $locationName    = $gaipConfig['location']['name'] ?? $activeSite->location_name ?: null;
        }

        // Sample dates
        $sampleDates = ['soil' => null, 'tissue' => null, 'water' => null];

        if ($activeSite) {
            Sample::where('site_id', $activeSite->id)
                ->whereIn('sample_type', ['soil', 'tissue', 'water'])
                ->whereNotNull('lab_date')
                ->orderByDesc('lab_date')
                ->get()
                ->groupBy('sample_type')
                ->each(function ($group, $type) use (&$sampleDates) {
                    $sampleDates[$type] = $group->first()?->lab_date?->toDateString();
                });
        }

        // Last spray log date
        $lastSprayDate = null;
        if ($activeSite) {
            $lastSprayDate = DB::table('spray_logs')
                ->where('site_id', $activeSite->id)
                ->orderByDesc('event_date')
                ->value('event_date');
        }

        // Analysis cache
        $analysisCacheRecord = $activeSite
            ? $activeSite->configs()->where('namespace', 'analysis_cache')->first()
            : null;
        $analysisCache = $analysisCacheRecord ? [
            'metrics'    => $analysisCacheRecord->config['metrics'] ?? null,
            'computed'   => $analysisCacheRecord->config['computed'] ?? null,
            'analyzedAt' => $analysisCacheRecord->synced_at?->toISOString(),
        ] : null;

        $gettingStartedSteps = [
            'soil'    => !is_null($sampleDates['soil']),
            'water'   => !is_null($sampleDates['water']),
            'tissue'  => !is_null($sampleDates['tissue']),
            'analysis' => !is_null($analysisCache),
        ];

        // Role on active site — used by JS for role-aware UI (e.g. Getting Started panel)
        $activeSiteRole = $activeSite ? $user?->roleOnSite($activeSite) : null;

        // provisionalName — wizard shows Site name field in Welcome step (Flow B)
        $provisionalName = $activeSite?->provisional_name ?? false;

        // Auto-open setup wizard for first-time users
        if ($activeSite?->provisional_name && ! $request->has('setup')) {
            return redirect()->route('dashboard', ['setup' => '1']);
        }

        return view('dashboard', [
            'activeSite'          => $activeSite,
            'allSites'            => $allSites,
            'savedLocation'       => $savedLocation,
            'sampleDates'         => $sampleDates,
            'lastSprayDate'       => $lastSprayDate,
            'turfSpecies'         => $turfSpecies,
            'turfMethodology'     => $turfMethodology,
            'locationName'        => $locationName,
            'analysisCache'       => $analysisCache,
            'gettingStartedSteps' => $gettingStartedSteps,
            'activeSiteRole'      => $activeSiteRole,
            'provisionalName'     => $provisionalName,
        ]);
    }
}
