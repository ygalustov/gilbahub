<?php

namespace App\Http\Controllers;

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
        $sites = $request->user()
            ->sites()
            ->with('configs')
            ->orderBy('name')
            ->get();

        return response()->json([
            'active_site_id' => $request->user()->last_active_site_id,
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
        ]);

        $site = Site::query()->create([
            ...$data,
            'owner_user_id' => $request->user()->id,
            'slug' => Str::slug($data['name']),
        ]);

        $site->users()->attach($request->user()->id, ['role' => 'owner']);

        SiteConfig::query()->create([
            'site_id' => $site->id,
            'namespace' => 'gaip',
            'config' => [],
            'synced_at' => now(),
        ]);

        if ($request->user()->last_active_site_id === null) {
            $request->user()->forceFill(['last_active_site_id' => $site->id])->save();
        }

        return response()->json([
            'data' => $this->sitePayload($site->load('configs')),
        ], 201);
    }

    public function show(Request $request, Site $site): JsonResponse
    {
        $this->abortUnlessMember($request, $site);

        return response()->json([
            'data' => $this->sitePayload($site->load('configs')),
        ]);
    }

    public function update(Request $request, Site $site): JsonResponse
    {
        $this->abortUnlessMember($request, $site);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'location_name' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'timezone' => ['nullable', 'string', 'max:80'],
        ]);

        if (isset($data['name'])) {
            $data['slug'] = Str::slug($data['name']);
        }

        $site->update($data);

        return response()->json([
            'data' => $this->sitePayload($site->load('configs')),
        ]);
    }


    public function setActive(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['required', 'integer', 'exists:sites,id'],
        ]);

        $site = Site::query()->findOrFail($data['site_id']);
        $this->abortUnlessMember($request, $site);

        $request->user()->forceFill([
            'last_active_site_id' => $site->id,
        ])->save();

        return response()->json([
            'active_site_id' => $site->id,
            'data' => $this->sitePayload($site->load('configs')),
        ]);
    }

    public function updateConfig(Request $request, Site $site, string $namespace = 'gaip'): JsonResponse
    {
        $this->abortUnlessMember($request, $site);

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

    private function abortUnlessMember(Request $request, Site $site): void
    {
        $isMember = $site->users()
            ->where('users.id', $request->user()->id)
            ->exists();

        abort_unless($isMember, 404);
    }

    private function sitePayload(Site $site): array
    {
        return [
            'id' => $site->id,
            'name' => $site->name,
            'slug' => $site->slug,
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
