<?php

namespace App\Http\Controllers;

use App\Models\Sample;
use App\Models\Site;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\View\View;

class AccountController extends Controller
{
    public function show(Request $request): View
    {
        $user     = $request->user();
        $allSites = $user->is_admin
            ? Site::query()->orderBy('name')->get()
            : ($user->sites()->orderBy('name')->get() ?? collect());

        $activeSite     = $user->activeSite;
        $sitesTableData = $this->buildSitesTableData($allSites, $user->last_active_site_id);
        $activeSiteRole = $activeSite ? $user->roleOnSite($activeSite) : null;

        return view('account', [
            'title'          => 'Account',
            'activeSite'     => $activeSite,
            'allSites'       => $allSites,
            'sitesTableData' => $sitesTableData,
            'activeSiteRole' => $activeSiteRole,
        ]);
    }

    private function buildSitesTableData(Collection $sites, ?string $activeSiteId): array
    {
        if ($sites->isEmpty()) {
            return [];
        }

        $siteIds = $sites->pluck('id')->all();

        $siteUsersMap = \DB::table('site_user')
            ->join('users', 'users.id', '=', 'site_user.user_id')
            ->whereIn('site_user.site_id', $siteIds)
            ->where('users.is_admin', false)
            ->select('site_user.site_id', 'site_user.role', 'users.id as user_id', 'users.name', 'users.email')
            ->get()
            ->groupBy('site_id');

        $allConfigs = \App\Models\SiteConfig::query()
            ->whereIn('site_id', $siteIds)
            ->whereIn('namespace', ['gaip', 'analysis_cache'])
            ->get()
            ->groupBy('site_id');

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

        return $sites->map(function ($site) use ($allConfigs, $soilCounts, $waterCounts, $activeSiteId, $siteUsersMap): array {
            $siteConfigs = $allConfigs->get($site->id, collect());
            $gaipConfig  = $siteConfigs->firstWhere('namespace', 'gaip');
            $cacheConfig = $siteConfigs->firstWhere('namespace', 'analysis_cache');

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

            $siteUsers = $siteUsersMap->get($site->id, collect());

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
                'user_count' => $siteUsers->count(),
                'users'      => $siteUsers->map(fn($u) => [
                    'id'    => $u->user_id,
                    'name'  => $u->name,
                    'email' => $u->email,
                    'role'  => $u->role,
                ])->values()->all(),
            ];
        })->values()->all();
    }
}
