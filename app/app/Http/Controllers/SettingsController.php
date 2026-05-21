<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;

class SettingsController extends Controller
{
    public function show(Request $request): View
    {
        $user       = $request->user();
        $activeSite = $user?->activeSite;
        $allSites   = $user?->sites()->orderBy('name')->get() ?? collect();

        $activeGaipConfig = [];
        if ($activeSite) {
            $activeSite->load('configs');
            $gaipRecord = $activeSite->configs()->where('namespace', 'gaip')->first();
            $activeGaipConfig = is_array($gaipRecord?->config) ? $gaipRecord->config : [];
        }

        $turfSpecies     = $activeGaipConfig['turf']['species'] ?? null;
        $turfMethodology = isset($activeGaipConfig['turf']['methodology'])
            ? strtoupper($activeGaipConfig['turf']['methodology'])
            : null;
        $locationName    = $activeGaipConfig['location']['name'] ?? $activeSite?->location_name ?: null;

        $cacheRecord   = $activeSite?->configs()->where('namespace', 'analysis_cache')->first();
        $analysisCache = $cacheRecord ? [
            'metrics'    => $cacheRecord->config['metrics'] ?? null,
            'computed'   => $cacheRecord->config['computed'] ?? null,
            'analyzedAt' => $cacheRecord->synced_at?->toISOString(),
        ] : null;

        return view('settings', [
            'title'            => 'Settings',
            'activeSite'       => $activeSite,
            'allSites'         => $allSites,
            'activeGaipConfig' => $activeGaipConfig,
            'turfSpecies'      => $turfSpecies,
            'turfMethodology'  => $turfMethodology,
            'locationName'     => $locationName,
            'analysisCache'    => $analysisCache,
        ]);
    }
}
