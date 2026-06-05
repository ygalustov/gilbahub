<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Site;
use App\Models\SiteConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SiteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $sites = $user->is_admin
            ? Site::query()->with('configs')->orderBy('name')->get()
            : $user->sites()->with('configs')->orderBy('name')->get();

        return response()->json([
            'active_site_id' => $user->last_active_site_id,
            'data' => $sites->map(fn (Site $site) => $this->sitePayload($site))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'location_name' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'timezone' => ['nullable', 'string', 'max:80'],
            'site_type' => ['nullable', 'string', 'max:32'],
            'precinct_group_id' => ['nullable', 'integer', 'exists:precinct_groups,id'],
            'parent_site_id' => ['nullable', 'string', 'exists:sites,id'],
        ]);

        $account = $this->currentAccount($request);

        $site = Site::query()->create([
            ...$data,
            'account_id' => $account->id,
            'site_type' => $data['site_type'] ?? 'precinct',
            'slug' => $this->uniqueSlug($account->id, $data['name']),
            'created_by_user_id' => $request->user()->id,
            'modified_by_user_id' => $request->user()->id,
        ]);

        // Admin sees all sites without site_user record
        if (! $request->user()->is_admin) {
            $site->users()->attach($request->user()->id, ['role' => 'manager']);
        }

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => (object)[],
            'synced_at' => now(),
        ]);

        $request->user()->forceFill(['last_active_site_id' => $site->id])->save();

        return response()->json([
            'data' => $this->sitePayload($site->load('configs')),
        ], 201);
    }

    public function syncRegistry(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sites' => ['required', 'array'],
        ]);

        $account = $this->currentAccount($request);
        $user = $request->user();
        $saved = 0;

        foreach ($data['sites'] as $siteId => $siteData) {
            if (! is_string($siteId) || trim($siteId) === '' || ! is_array($siteData)) {
                continue;
            }

            $name = trim((string) ($siteData['label'] ?? $siteData['name'] ?? $siteId));
            $site = Site::query()->find($siteId);

            if ($site) {
                abort_unless($user->canEditSite($site), 403);
                $site->update([
                    'name' => $name !== '' ? $name : $site->name,
                    'modified_by_user_id' => $user->id,
                ]);
            } else {
                $site = new Site();
                $site->forceFill([
                    'id' => $siteId,
                    'account_id' => $account->id,
                    'name' => $name !== '' ? $name : $siteId,
                    'slug' => $this->uniqueSlug($account->id, $name !== '' ? $name : $siteId),
                    'site_type' => 'precinct',
                    'timezone' => 'Australia/Sydney',
                    'created_by_user_id' => $user->id,
                    'modified_by_user_id' => $user->id,
                ])->save();

                if (! $user->is_admin) {
                    $site->users()->attach($user->id, ['role' => 'manager']);
                }
            }

            SiteConfig::query()->firstOrCreate(
                [
                    'site_id' => $site->id,
                    'namespace' => 'gaip',
                ],
                [
                    'config' => (object)[],
                    'synced_at' => now(),
                ]
            );

            $saved++;
        }

        return response()->json([
            'data' => [
                'saved' => $saved,
            ],
        ]);
    }

    public function show(Request $request, string $site): JsonResponse
    {
        $site = $this->resolveAccessibleSite($request, $site);
        abort_unless($request->user()->canViewSite($site), 403);

        return response()->json([
            'data' => $this->sitePayload($site->load('configs')),
        ]);
    }

    public function update(Request $request, string $site): JsonResponse
    {
        $site = $this->resolveAccessibleSite($request, $site);
        abort_unless($request->user()->canEditSite($site), 403);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'location_name' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'timezone' => ['nullable', 'string', 'max:80'],
            'site_type' => ['nullable', 'string', 'max:32'],
            'methodology_override' => ['nullable', 'string', 'max:32'],
            'soil_texture_override' => ['nullable', 'string', 'max:32'],
            'attributes_json' => ['nullable', 'array'],
            'precinct_group_id' => ['nullable', 'integer', 'exists:precinct_groups,id'],
            'parent_site_id' => ['nullable', 'string', Rule::exists('sites', 'id')->whereNot('id', $site->id)],
        ]);

        if (isset($data['name'])) {
            $data['slug'] = $this->uniqueSlug($site->account_id, $data['name'], $site->id);
        }

        $data['modified_by_user_id'] = $request->user()->id;
        $site->update($data);

        return response()->json([
            'data' => $this->sitePayload($site->load('configs')),
        ]);
    }

    public function setActive(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['required', 'string', 'exists:sites,id'],
        ]);

        $site = Site::query()->findOrFail($data['site_id']);
        abort_unless($request->user()->canViewSite($site), 403);

        $request->user()->forceFill([
            'last_active_site_id' => $site->id,
        ])->save();

        return response()->json([
            'active_site_id' => $site->id,
            'data' => $this->sitePayload($site->load('configs')),
        ]);
    }

    public function destroy(Request $request, string $site): JsonResponse
    {
        $site = $this->resolveAccessibleSite($request, $site);
        abort_unless($request->user()->canManageSite($site), 403);

        $user = $request->user();

        $remainingCount = $user->is_admin
            ? Site::query()->where('id', '!=', $site->id)->count()
            : $user->sites()->where('sites.id', '!=', $site->id)->count();

        if ($remainingCount === 0) {
            return response()->json(['message' => 'Cannot delete the only site.'], 422);
        }

        if ($user->last_active_site_id === $site->id) {
            $next = $user->is_admin
                ? Site::query()->where('id', '!=', $site->id)->orderBy('name')->first()
                : $user->sites()->where('sites.id', '!=', $site->id)->orderBy('sites.name')->first();
            $user->forceFill(['last_active_site_id' => $next?->id])->save();
        }

        $site->users()->detach();
        $site->configs()->delete();
        $site->delete();

        return response()->json(['deleted' => true]);
    }

    public function updateConfig(Request $request, string $site, string $namespace = 'gaip'): JsonResponse
    {
        $site = $this->resolveAccessibleSite($request, $site);
        abort_unless($request->user()->canEditSite($site), 403);

        $data = $request->validate([
            'config' => ['present', 'array'],
            'namespace' => ['nullable', 'string', 'max:40', Rule::in(['gaip', 'gssh'])],
        ]);

        $namespace = $data['namespace'] ?? $namespace;

        $config = SiteConfig::query()->updateOrCreate(
            [
                'site_id' => $site->id,
                'namespace' => $namespace,
            ],
            [
                'config' => $data['config'],
                'synced_at' => now(),
            ]
        );

        return response()->json([
            'data' => [
                'site_id' => $site->id,
                'namespace' => $config->namespace,
                'config' => $config->config ?? [],
                'synced_at' => $config->synced_at?->toISOString(),
            ],
        ]);
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

    private function resolveAccessibleSite(Request $request, string $siteIdentifier): Site
    {
        $user = $request->user();

        $query = Site::query()->where(function ($q) use ($siteIdentifier) {
            $q->where('id', $siteIdentifier)->orWhere('slug', $siteIdentifier);
        });

        if (! $user->is_admin) {
            $query->whereHas('users', function ($q) use ($user) {
                $q->where('users.id', $user->id);
            });
        }

        $site = $query->first();
        abort_unless($site, 404);

        return $site;
    }

    private function uniqueSlug(int $accountId, string $name, ?string $ignoreSiteId = null): string
    {
        $base = Str::slug($name) ?: 'site';
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

    private function sitePayload(Site $site): array
    {
        return [
            'id' => $site->id,
            'account_id' => $site->account_id,
            'precinct_group_id' => $site->precinct_group_id,
            'parent_site_id' => $site->parent_site_id,
            'name' => $site->name,
            'slug' => $site->slug,
            'site_type' => $site->site_type,
            'location_name' => $site->location_name,
            'latitude' => $site->latitude,
            'longitude' => $site->longitude,
            'timezone' => $site->timezone,
            'configs' => $site->configs->mapWithKeys(fn (SiteConfig $config) => [
                $config->namespace => [
                    'config' => $config->config ?? [],
                    'synced_at' => $config->synced_at?->toISOString(),
                ],
            ]),
        ];
    }
}
