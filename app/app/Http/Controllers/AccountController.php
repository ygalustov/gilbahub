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

        return view('account', [
            'title'          => 'Account',
            'currentPage'    => 'account',
            'activeSite'     => $activeSite,
            'allSites'       => $allSites,
            'sitesTableData' => $sitesTableData,
            'activeSiteRole' => $activeSiteRole,
            'turfSpecies'    => $turfSpecies,
            'turfMethodology' => $turfMethodology,
            'locationName'   => $locationName,
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

        $siteInvitationsMap = \DB::table('invitations')
            ->whereIn('site_id', $siteIds)
            ->select('site_id', 'id', 'name', 'email', 'role')
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

        return $sites->map(function ($site) use ($allConfigs, $soilCounts, $waterCounts, $activeSiteId, $siteUsersMap, $siteInvitationsMap): array {
            $siteConfigs = $allConfigs->get($site->id, collect());
            $gaipConfig  = $siteConfigs->firstWhere('namespace', 'gaip');
            $cacheConfig = $siteConfigs->firstWhere('namespace', 'analysis_cache');

            $gaip    = is_array($gaipConfig?->config) ? $gaipConfig->config : [];
            $species = $gaip['turf']['species'] ?? null;
            $hoc     = $gaip['turf']['hoc'] ?? null;

            // GH-541: the methodology of THIS site, read from THIS site's own
            // `config.turf.methodology` and from nowhere else.
            //
            // `show()` above resolves `$turfMethodology` for the ACTIVE site.
            // That variable is deliberately not used here and must never be:
            // this method builds a row per site, and a row that printed the
            // active site's setting under another site's name is GH-459 in
            // miniature — the page showing one object's data beside another
            // object's label. There it cost a client another site's climate in
            // his own report, and the annual totals still agreed, so nothing
            // went red. This screen is meant to be the place the owner comes to
            // check what is set where, which is exactly the screen that must
            // not be wrong quietly.
            $methodologyKey = $gaip['turf']['methodology'] ?? null;

            $cacheData = is_array($cacheConfig?->config) ? $cacheConfig->config : [];
            $gpRaw     = $cacheData['metrics']['growthPotential'] ?? null;
            $status    = null;
            if ($gpRaw !== null) {
                $gp     = (float) $gpRaw >= 1 ? (float) $gpRaw : (float) $gpRaw * 100;
                $status = $gp >= 70 ? 'green' : ($gp >= 40 ? 'amber' : 'red');
            }

            $siteUsers       = $siteUsersMap->get($site->id, collect());
            $siteInvitations = $siteInvitationsMap->get($site->id, collect());

            $members = $siteUsers->map(fn($u) => [
                'id'     => $u->user_id,
                'name'   => $u->name,
                'email'  => $u->email,
                'role'   => $u->role,
                'status' => 'active',
            ])->values()->all();

            $invited = $siteInvitations->map(fn($i) => [
                'id'     => $i->id,
                'name'   => $i->name,
                'email'  => $i->email,
                'role'   => $i->role,
                'status' => 'invited',
            ])->values()->all();

            return [
                'id'         => $site->id,
                'name'       => $site->name,
                'site_type'  => $site->site_type,
                'location'   => $gaip['location']['name'] ?? $site->location_name,
                'species'    => $species,
                'hoc'        => $hoc !== null ? (float) $hoc : null,
                // Null stays null. An empty configuration is an outcome, not a
                // reason to substitute: the row prints "methodology not set"
                // and no default is invented.
                'methodology' => self::methodologyLabel($methodologyKey),
                'soil'       => (int) ($soilCounts[$site->id] ?? 0),
                'water'      => (int) ($waterCounts[$site->id] ?? 0),
                'last_run'   => $cacheConfig?->synced_at?->toISOString(),
                'is_active'  => $site->id === $activeSiteId,
                'status'     => $status,
                'user_count' => $siteUsers->count() + $siteInvitations->count(),
                'users'      => array_merge($members, $invited),
            ];
        })->values()->all();
    }

    /**
     * GH-541 — the short label for a methodology key.
     *
     * THE WORDS ARE NOT INVENTED HERE. They are the Settings form's own, in
     * `resources/views/settings.blade.php` (`$methOptions`), shortened to what
     * fits a table cell: the select shows "MLSN — Minimum Levels for
     * Sustainable Nutrition" because a dropdown has room to explain itself, and
     * a column does not.
     *
     * AND THE CASE IS NOT `strtoupper()`. `show()` upper-cases for the single
     * active-site line; applied to a column this produces `AMMONIUM_ACETATE`,
     * which is the storage key shouted rather than a name, sitting next to
     * "Browntop Bent". MLSN and SLAN are acronyms and stay upper because they
     * are acronyms, not because of a transform.
     *
     * An unknown key is returned as it is rather than hidden: a value the
     * Settings form cannot produce is worth seeing on a screen whose purpose is
     * to show what is set.
     */
    public static function methodologyLabel(?string $key): ?string
    {
        if ($key === null || $key === '') {
            return null;
        }

        return [
            'mlsn'             => 'MLSN',
            'slan'             => 'SLAN',
            'ammonium_acetate' => 'Ammonium Acetate',
        ][$key] ?? $key;
    }
}
