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

        // GH-294: soil_texture_override lives on the Site model (falling back
        // to the account's soil_texture), not inside the gaip JSON config --
        // same site-override-then-account-fallback chain established at
        // SampleController.php:374 / HillLabsSampleTypes.resolveSoilTexture().
        // Needed by the Plan page's GAIP_STATE bridge below so
        // HillLabsSampleTypes.deriveCode() (AA certificate lookup, GH-291) has
        // a real texture to work with instead of always seeing '' (which
        // deriveCode() reads as "not sand" -> silently falls back to the
        // generic sands/others range regardless of the site's real texture).
        $soilTexture = $activeSite?->soil_texture_override ?: $activeSite?->account?->soil_texture;

        return compact(
            'activeSite', 'allSites', 'turfSpecies', 'turfMethodology',
            'locationName', 'analysisCache', 'gaipConfig', 'savedLocation',
            'soilTexture'
        );
    }
}
