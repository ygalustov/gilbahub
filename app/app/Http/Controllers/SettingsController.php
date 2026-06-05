<?php

namespace App\Http\Controllers;

use App\Models\Sample;
use App\Models\Site;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\View\View;

class SettingsController extends Controller
{
    public function show(Request $request): View
    {
        $user       = $request->user();
        $activeSite = $user?->activeSite;
        $allSites   = $user?->is_admin
            ? Site::query()->orderBy('name')->get()
            : ($user?->sites()->orderBy('name')->get() ?? collect());

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

        $sitesTableData = $this->buildSitesTableData($allSites, $user?->last_active_site_id);
        $activeSiteRole = $activeSite ? $user?->roleOnSite($activeSite) : null;

        return view('settings', [
            'title'            => 'Settings',
            'activeSite'       => $activeSite,
            'allSites'         => $allSites,
            'sitesTableData'   => $sitesTableData,
            'activeGaipConfig' => $activeGaipConfig,
            'turfSpecies'      => $turfSpecies,
            'turfMethodology'  => $turfMethodology,
            'locationName'     => $locationName,
            'analysisCache'    => $analysisCache,
            'activeSiteRole'   => $activeSiteRole,
        ]);
    }

    private function buildSitesTableData(Collection $sites, ?string $activeSiteId): array
    {
        if ($sites->isEmpty()) {
            return [];
        }

        $siteIds = $sites->pluck('id')->all();

        // Load all configs for all sites in one query
        $allConfigs = \App\Models\SiteConfig::query()
            ->whereIn('site_id', $siteIds)
            ->whereIn('namespace', ['gaip', 'analysis_cache'])
            ->get()
            ->groupBy('site_id');

        // Sample counts per site (soil + water) in two queries
        $soilCounts = Sample::query()
            ->whereIn('site_id', $siteIds)
            ->where('sample_type', 'soil')
            ->selectRaw('site_id, count(*) as cnt')
            ->groupBy('site_id')
            ->pluck('cnt', 'site_id');

        $waterCounts = Sample::query()
            ->whereIn('site_id', $siteIds)
            ->where('sample_type', 'water')
            ->selectRaw('site_id, count(*) as cnt')
            ->groupBy('site_id')
            ->pluck('cnt', 'site_id');

        return $sites->map(function ($site) use ($allConfigs, $soilCounts, $waterCounts, $activeSiteId): array {
            $siteConfigs  = $allConfigs->get($site->id, collect());
            $gaipConfig   = $siteConfigs->firstWhere('namespace', 'gaip');
            $cacheConfig  = $siteConfigs->firstWhere('namespace', 'analysis_cache');

            $gaip    = is_array($gaipConfig?->config) ? $gaipConfig->config : [];
            $species = $gaip['turf']['species'] ?? null;
            $hoc     = $gaip['turf']['hoc'] ?? null;

            $cacheData = is_array($cacheConfig?->config) ? $cacheConfig->config : [];
            $gpRaw     = $cacheData['metrics']['growthPotential'] ?? null;
            $status    = null;
            if ($gpRaw !== null) {
                $gp     = (float) $gpRaw > 1 ? (float) $gpRaw : (float) $gpRaw * 100;
                $status = $gp >= 70 ? 'green' : ($gp >= 40 ? 'amber' : 'red');
            }

            return [
                'id'         => $site->id,
                'name'       => $site->name,
                'site_type'  => $site->site_type,
                'location'   => $site->location_name,
                'species'    => $species,
                'hoc'        => $hoc !== null ? (float) $hoc : null,
                'soil'       => (int) ($soilCounts[$site->id] ?? 0),
                'water'      => (int) ($waterCounts[$site->id] ?? 0),
                'last_run'   => $cacheConfig?->synced_at?->toISOString(),
                'is_active'  => $site->id === $activeSiteId,
                'status'     => $status,
            ];
        })->values()->all();
    }
}
