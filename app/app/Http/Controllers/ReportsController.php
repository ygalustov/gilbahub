<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;

class ReportsController extends Controller
{
    public function export(Request $request): View
    {
        return view('reports.export', $this->pageData($request, 'export'));
    }

    public function forensic(Request $request): View
    {
        return view('reports.forensic', $this->pageData($request, 'forensic'));
    }

    public function scenarios(Request $request): View
    {
        return view('reports.scenarios', $this->pageData($request, 'scenarios'));
    }

    public function accuracy(Request $request): View
    {
        return view('reports.accuracy', $this->pageData($request, 'accuracy'));
    }

    private function pageData(Request $request, string $tab): array
    {
        $user       = $request->user();
        $activeSite = $user?->activeSite;
        $allSites   = $user?->sites()->orderBy('name')->get() ?? collect();

        $turfSpecies     = null;
        $turfMethodology = null;
        $locationName    = null;
        $analysisCache   = null;
        $savedLocation   = ['name' => '', 'lat' => '', 'lon' => ''];

        if ($activeSite) {
            $gaipRecord      = $activeSite->configs()->where('namespace', 'gaip')->first();
            $gaipConfig      = is_array($gaipRecord?->config) ? $gaipRecord->config : [];
            $turfSpecies     = $gaipConfig['turf']['species'] ?? null;
            $turfMethodology = strtoupper(self::effectiveMethodology(
                $gaipConfig['turf']['methodology'] ?? null,
                $activeSite->latitude  !== null ? (float) $activeSite->latitude  : null,
                $activeSite->longitude !== null ? (float) $activeSite->longitude : null,
            ));
            $locationName    = $gaipConfig['location']['name'] ?? $activeSite->location_name ?: null;
            // GH-253: savedLocation feeds the .gaip-lat/.gaip-lon inputs that
            // RegionalProfiles.detectRegionFromHub() reads to pick the NZ vs AU
            // product catalogue for Word exports. It must read the site's own
            // latitude/longitude columns first, same as PageController and
            // AnalysisController's $savedLocation — not the gaip config
            // namespace, which can go stale after a coordinate change that
            // only writes to the sites table (see D30, Hoxton Prebbles export
            // recommending AU-catalogue products for an NZ site).
            $savedLocation   = [
                'name' => $activeSite->location_name ?? '',
                'lat'  => $activeSite->latitude ?? '',
                'lon'  => $activeSite->longitude ?? '',
            ];

            $cacheRecord = $activeSite->configs()->where('namespace', 'analysis_cache')->first();
            if ($cacheRecord) {
                $analysisCache = [
                    'metrics'    => $cacheRecord->config['metrics'] ?? null,
                    'computed'   => $cacheRecord->config['computed'] ?? null,
                    'analyzedAt' => $cacheRecord->synced_at?->toISOString(),
                ];
            }
        }

        return compact(
            'activeSite', 'allSites',
            'turfSpecies', 'turfMethodology', 'locationName',
            'analysisCache', 'savedLocation', 'tab',
        );
    }
}
