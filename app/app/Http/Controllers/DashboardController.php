<?php

namespace App\Http\Controllers;

use App\Models\Sample;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function show(Request $request): View
    {
        $user       = $request->user();
        $activeSite = $user?->activeSite;

        $allSites = $user?->sites()->orderBy('name')->get() ?? collect();

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
            $turfMethodology = isset($gaipConfig['turf']['methodology'])
                ? strtoupper($gaipConfig['turf']['methodology'])
                : null;
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

        // Analysis cache — latest engine results, stored in site_configs namespace='analysis_cache'
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
            // 'sensors' resolved client-side (API key in localStorage)
        ];

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
        ]);
    }
}
