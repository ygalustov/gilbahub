<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;

class AnalysisController extends Controller
{
    public function index(Request $request): View
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
        $turfVariety      = null;
        $turfSiteType     = null;
        $companionSpecies = null;
        $overseedSpecies  = null;
        $turfMethodology  = null;
        $percentC3Cover   = null;
        $locationName     = null;

        if ($activeSite) {
            $gaipRecord       = $activeSite->configs()->where('namespace', 'gaip')->first();
            $gaipConfig       = is_array($gaipRecord?->config) ? $gaipRecord->config : [];
            $turfSpecies      = $gaipConfig['turf']['species'] ?? null;
            $turfVariety      = $gaipConfig['turf']['variety'] ?? null;
            $turfSiteType     = $gaipConfig['turf']['turfType'] ?? null;
            $companionSpecies = $gaipConfig['turf']['companionSpecies'] ?? null;
            $overseedSpecies = $gaipConfig['turf']['overseedSpecies']
                ?? $gaipConfig['turf']['coolOverseed']
                ?? null;
            $siteLat = $activeSite->latitude  !== null ? (float) $activeSite->latitude  : (isset($gaipConfig['location']['lat']) ? (float) $gaipConfig['location']['lat'] : null);
            $siteLon = $activeSite->longitude !== null ? (float) $activeSite->longitude : (isset($gaipConfig['location']['lon']) ? (float) $gaipConfig['location']['lon'] : null);
            $turfMethodology = strtoupper(self::effectiveMethodology(
                $gaipConfig['turf']['methodology'] ?? null,
                $siteLat,
                $siteLon
            ));
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

        // Force ammonium_acetate into the cached soilNutrition for NZ sites,
        // overriding whatever the JS analysis last persisted.
        if ($activeSite && $analysisCache !== null && self::isNewZealand($siteLat ?? null, $siteLon ?? null)) {
            $analysisCache['computed']['soilNutrition']['methodology'] = 'ammonium_acetate';
        }

        return view('analysis', [
            'activeSite'       => $activeSite,
            'allSites'         => $allSites,
            'savedLocation'    => $savedLocation,
            'turfSpecies'      => $turfSpecies,
            'turfVariety'      => $turfVariety,
            'turfSiteType'     => $turfSiteType,
            'companionSpecies' => $companionSpecies,
            'overseedSpecies'  => $overseedSpecies,
            'turfMethodology'  => $turfMethodology,
            'percentC3Cover'   => $percentC3Cover,
            'locationName'     => $locationName,
            'analysisCache'    => $analysisCache,
        ]);
    }

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
            $siteLat = $activeSite->latitude  !== null ? (float) $activeSite->latitude  : (isset($gaipConfig['location']['lat']) ? (float) $gaipConfig['location']['lat'] : null);
            $siteLon = $activeSite->longitude !== null ? (float) $activeSite->longitude : (isset($gaipConfig['location']['lon']) ? (float) $gaipConfig['location']['lon'] : null);
            $turfMethodology = strtoupper(self::effectiveMethodology(
                $gaipConfig['turf']['methodology'] ?? null,
                $siteLat,
                $siteLon
            ));
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

    public function disease(Request $request): View
    {
        $user       = $request->user();
        $activeSite = $user?->activeSite;
        $allSites   = $user?->sites()->orderBy('name')->get() ?? collect();

        $gaipConfig      = [];
        $turfSpecies     = null;
        $turfMethodology = null;
        $locationName    = null;

        if ($activeSite) {
            $gaipRecord      = $activeSite->configs()->where('namespace', 'gaip')->first();
            $gaipConfig      = is_array($gaipRecord?->config) ? $gaipRecord->config : [];
            $turfSpecies     = $gaipConfig['turf']['species'] ?? null;
            $siteLat = $activeSite->latitude  !== null ? (float) $activeSite->latitude  : (isset($gaipConfig['location']['lat']) ? (float) $gaipConfig['location']['lat'] : null);
            $siteLon = $activeSite->longitude !== null ? (float) $activeSite->longitude : (isset($gaipConfig['location']['lon']) ? (float) $gaipConfig['location']['lon'] : null);
            $turfMethodology = strtoupper(self::effectiveMethodology(
                $gaipConfig['turf']['methodology'] ?? null,
                $siteLat,
                $siteLon
            ));
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

        return view('analysis.disease', [
            'activeSite'      => $activeSite,
            'allSites'        => $allSites,
            'turfSpecies'     => $turfSpecies,
            'turfMethodology' => $turfMethodology,
            'locationName'    => $locationName,
            'analysisCache'   => $analysisCache,
        ]);
    }
}
