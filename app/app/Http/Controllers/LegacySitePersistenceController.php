<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class LegacySitePersistenceController extends Controller
{
    public function loadSites(Request $request): JsonResponse
    {
        $sites = $request->user()
            ->sites()
            ->orderBy('name')
            ->get();

        $payload = [];

        foreach ($sites as $site) {
            $payload[(string) $site->id] = [
                'label' => $site->name,
                'createdAt' => $site->created_at?->toISOString(),
            ];
        }

        return $this->success([
            'sites' => $payload,
            'count' => count($payload),
        ]);
    }

    public function saveSites(Request $request): JsonResponse
    {
        $sites = $this->legacyArray($request, 'sites');
        $account = $this->currentAccount($request);
        $saved = 0;

        foreach ($sites as $legacyId => $legacySite) {
            if (! is_array($legacySite)) {
                continue;
            }

            $label = trim((string) ($legacySite['label'] ?? $legacyId));

            if ($label === '') {
                continue;
            }

            $site = $this->resolveSite($request, (string) $legacyId);
            $siteData = [
                'account_id' => $account->id,
                'name' => $label,
                'slug' => $site?->slug ?? $this->uniqueSlug($account->id, $label),
                'site_type' => $site?->site_type ?? 'precinct',
                'modified_by_user_id' => $request->user()->id,
            ];

            if ($site) {
                $site->update(Arr::except($siteData, ['account_id']));
            } else {
                $site = Site::query()->create([
                    ...$siteData,
                    'created_by_user_id' => $request->user()->id,
                ]);
            }

            $this->attachCurrentUser($request, $site);
            $this->ensureConfig($site);
            $this->ensureActiveSite($request, $site);

            $saved++;
        }

        return $this->success(['saved' => $saved]);
    }

    public function loadSiteConfigs(Request $request): JsonResponse
    {
        $sites = $request->user()
            ->sites()
            ->with('configs')
            ->orderBy('name')
            ->get();

        $configs = [];

        foreach ($sites as $site) {
            $config = $site->configs
                ->firstWhere('namespace', 'gaip')
                ?->config ?? [];

            $configs[(string) $site->id] = $config;
        }

        return $this->success([
            'configs' => $configs,
            'count' => count($configs),
        ]);
    }

    public function saveSiteConfigs(Request $request): JsonResponse
    {
        $configs = $this->legacyArray($request, 'configs');
        $account = $this->currentAccount($request);
        $saved = 0;

        foreach ($configs as $legacyId => $config) {
            if (! is_array($config)) {
                continue;
            }

            $site = $this->resolveSite($request, (string) $legacyId);

            if (! $site) {
                $site = Site::query()->create([
                    'account_id' => $account->id,
                    'name' => $this->siteNameFromConfig((string) $legacyId, $config),
                    'slug' => $this->uniqueSlug($account->id, (string) $legacyId),
                    'site_type' => 'precinct',
                    'created_by_user_id' => $request->user()->id,
                    'modified_by_user_id' => $request->user()->id,
                ]);
            }

            $site->fill([
                ...$this->siteLocationData($config),
                'modified_by_user_id' => $request->user()->id,
            ])->save();
            $this->attachCurrentUser($request, $site);

            $this->ensureConfig($site, $config);
            $this->ensureActiveSite($request, $site);

            $saved++;
        }

        return $this->success(['saved' => $saved]);
    }

    private function currentAccount(Request $request): Account
    {
        return Account::query()->firstOrCreate(
            ['owner_user_id' => $request->user()->id],
            [
                'display_name' => $request->user()->name,
                'created_by_user_id' => $request->user()->id,
                'modified_by_user_id' => $request->user()->id,
            ]
        );
    }

    private function legacyArray(Request $request, string $field): array
    {
        $value = $request->input($field, []);

        if (is_string($value)) {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? $decoded : [];
        }

        return is_array($value) ? $value : [];
    }

    private function resolveSite(Request $request, string $legacyId): ?Site
    {
        $query = $request->user()->sites();

        $site = (clone $query)->where('sites.id', $legacyId)->first();
        if ($site) {
            return $site;
        }

        return (clone $query)->where('sites.slug', Str::slug($legacyId))->first();
    }

    private function ensureConfig(Site $site, array $config = []): SiteConfig
    {
        return SiteConfig::query()->updateOrCreate(
            [
                'site_id' => $site->id,
                'namespace' => 'gaip',
            ],
            [
                'config' => $config,
                'synced_at' => now(),
            ]
        );
    }

    private function attachCurrentUser(Request $request, Site $site): void
    {
        $site->users()->syncWithoutDetaching([
            $request->user()->id => ['role' => 'owner'],
        ]);
    }

    private function ensureActiveSite(Request $request, Site $site): void
    {
        if ($request->user()->last_active_site_id === null) {
            $request->user()->forceFill(['last_active_site_id' => $site->id])->save();
        }
    }

    private function siteLocationData(array $config): array
    {
        $location = $config['location'] ?? [];

        if (! is_array($location)) {
            return [];
        }

        return array_filter([
            'location_name' => $location['name'] ?? $location['label'] ?? null,
            'latitude' => $location['lat'] ?? $location['latitude'] ?? null,
            'longitude' => $location['lon'] ?? $location['lng'] ?? $location['longitude'] ?? null,
            'timezone' => $location['timezone'] ?? null,
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function siteNameFromConfig(string $legacyId, array $config): string
    {
        $location = $config['location'] ?? [];

        if (is_array($location)) {
            $name = trim((string) ($location['name'] ?? $location['label'] ?? ''));

            if ($name !== '') {
                return $name;
            }
        }

        return Str::headline($legacyId);
    }

    private function uniqueSlug(int $accountId, string $value, ?string $ignoreSiteId = null): string
    {
        $base = Str::slug($value) ?: 'site';
        $slug = $base;
        $index = 2;

        while (Site::query()
            ->where('account_id', $accountId)
            ->when($ignoreSiteId, fn ($query) => $query->where('id', '!=', $ignoreSiteId))
            ->where('slug', $slug)
            ->exists()) {
            $slug = $base.'-'.$index;
            $index++;
        }

        return $slug;
    }

    private function success(array $data): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }
}
