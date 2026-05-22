<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;

class PageController extends Controller
{
    public function plan(Request $request): View
    {
        return view('plan', $this->topbarData($request));
    }

    public function reports(Request $request): View
    {
        return view('reports', $this->topbarData($request));
    }

    private function topbarData(Request $request): array
    {
        $user       = $request->user();
        $activeSite = $user?->activeSite;
        $allSites   = $user?->sites()->orderBy('name')->get() ?? collect();

        $turfSpecies     = null;
        $turfMethodology = null;
        $locationName    = null;
        $analysisCache   = null;
        $gaipConfig      = [];

        if ($activeSite) {
            $gaipRecord      = $activeSite->configs()->where('namespace', 'gaip')->first();
            $gaipConfig      = is_array($gaipRecord?->config) ? $gaipRecord->config : [];
            $turfSpecies     = $gaipConfig['turf']['species'] ?? null;
            $turfMethodology = isset($gaipConfig['turf']['methodology'])
                ? strtoupper($gaipConfig['turf']['methodology'])
                : null;
            $locationName    = $gaipConfig['location']['name'] ?? $activeSite->location_name ?: null;

            $cacheRecord = $activeSite->configs()->where('namespace', 'analysis_cache')->first();
            if ($cacheRecord) {
                $analysisCache = [
                    'metrics'    => $cacheRecord->config['metrics'] ?? null,
                    'computed'   => $cacheRecord->config['computed'] ?? null,
                    'analyzedAt' => $cacheRecord->synced_at?->toISOString(),
                ];
            }
        }

        $savedLocation = [
            'lat' => $activeSite?->latitude  ?? '',
            'lon' => $activeSite?->longitude ?? '',
            'name' => $locationName ?? '',
        ];

        return compact(
            'activeSite', 'allSites', 'turfSpecies', 'turfMethodology',
            'locationName', 'analysisCache', 'gaipConfig', 'savedLocation'
        );
    }
}
