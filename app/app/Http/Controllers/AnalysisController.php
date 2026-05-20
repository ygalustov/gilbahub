<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;

class AnalysisController extends Controller
{
    public function growthLight(Request $request): View
    {
        $user       = $request->user();
        $activeSite = $user?->activeSite;
        $allSites   = $user?->sites()->orderBy('name')->get() ?? collect();

        $savedLocation = [
            'name' => $activeSite?->location_name ?? '',
            'lat'  => $activeSite?->latitude ?? '',
            'lon'  => $activeSite?->longitude ?? '',
        ];

        $gaipConfig       = [];
        $turfSpecies      = null;
        $overseedSpecies  = null;
        $turfMethodology  = null;
        $percentC3Cover   = null;
        $locationName     = null;

        if ($activeSite) {
            $gaipRecord      = $activeSite->configs()->where('namespace', 'gaip')->first();
            $gaipConfig      = is_array($gaipRecord?->config) ? $gaipRecord->config : [];
            $turfSpecies     = $gaipConfig['turf']['species'] ?? null;
            $overseedSpecies = $gaipConfig['turf']['overseedSpecies']
                ?? $gaipConfig['turf']['coolOverseed']
                ?? null;
            $turfMethodology = isset($gaipConfig['turf']['methodology'])
                ? strtoupper($gaipConfig['turf']['methodology'])
                : null;
            $percentC3Cover  = isset($gaipConfig['turf']['c3Cover'])
                ? (float) $gaipConfig['turf']['c3Cover']
                : null;
            $locationName    = $gaipConfig['location']['name'] ?? $activeSite->location_name ?: null;
        }

        $analysisCacheRecord = $activeSite
            ? $activeSite->configs()->where('namespace', 'analysis_cache')->first()
            : null;

        $analysisCache = $analysisCacheRecord ? [
            'metrics'    => $analysisCacheRecord->config['metrics'] ?? null,
            'computed'   => $analysisCacheRecord->config['computed'] ?? null,
            'analyzedAt' => $analysisCacheRecord->synced_at?->toISOString(),
        ] : null;

        return view('analysis.growth-light', [
            'activeSite'      => $activeSite,
            'allSites'        => $allSites,
            'savedLocation'   => $savedLocation,
            'turfSpecies'     => $turfSpecies,
            'overseedSpecies' => $overseedSpecies,
            'turfMethodology' => $turfMethodology,
            'percentC3Cover'  => $percentC3Cover,
            'locationName'    => $locationName,
            'analysisCache'   => $analysisCache,
        ]);
    }
}
