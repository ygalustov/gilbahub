<?php

namespace App\Http\Controllers;

use App\Models\Site;
use App\Models\SiteConfig;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class LegacyAjaxController extends Controller
{
    public function handle(Request $request): JsonResponse
    {
        if (! $this->hasValidNonce($request)) {
            return $this->error('Invalid nonce', 403, 'nonce_expired');
        }

        return match ((string) $request->input('action', '')) {
            'gilba_geocode_search' => $this->geocodeSearch($request),
            'gilba_reverse_geocode' => $this->reverseGeocode($request),
            'gilba_save_location' => $this->saveLocation($request),
            default => $this->error('Unknown action', 400),
        };
    }

    private function geocodeSearch(Request $request): JsonResponse
    {
        $query = trim((string) $request->input('address', ''));

        if (mb_strlen($query) < 3) {
            return $this->success([]);
        }

        $response = Http::acceptJson()
            ->timeout(10)
            ->get('https://geocoding-api.open-meteo.com/v1/search', [
                'name' => $query,
                'count' => 8,
                'language' => 'en',
                'format' => 'json',
            ]);

        if (! $response->successful()) {
            return $this->error('Geocoding search failed', 502);
        }

        $results = collect($response->json('results', []))
            ->map(function (array $item): array {
                return [
                    'display_name' => collect([
                        $item['name'] ?? null,
                        $item['admin1'] ?? null,
                        $item['country'] ?? null,
                    ])->filter()->join(', '),
                    'lat' => $item['latitude'] ?? null,
                    'lon' => $item['longitude'] ?? null,
                ];
            })
            ->filter(fn (array $item): bool => $item['display_name'] !== '' && $item['lat'] !== null && $item['lon'] !== null)
            ->values()
            ->all();

        return $this->success($results);
    }

    private function reverseGeocode(Request $request): JsonResponse
    {
        $lat = $request->input('lat');
        $lon = $request->input('lon');

        if (! is_numeric($lat) || ! is_numeric($lon)) {
            return $this->error('Invalid coordinates', 422);
        }

        $response = Http::acceptJson()
            ->withHeaders(['User-Agent' => 'GilbaStandalone/1.0'])
            ->timeout(10)
            ->get('https://nominatim.openstreetmap.org/reverse', [
                'format' => 'jsonv2',
                'lat' => $lat,
                'lon' => $lon,
                'zoom' => 16,
                'addressdetails' => 1,
            ]);

        if (! $response->successful()) {
            return $this->success(['name' => null]);
        }

        $payload = $response->json();
        $address = $payload['address'] ?? [];

        $name = collect([
            $address['suburb'] ?? null,
            $address['town'] ?? null,
            $address['city'] ?? null,
            $address['state'] ?? null,
            $address['country'] ?? null,
        ])->filter()->unique()->take(2)->join(', ');

        if ($name === '') {
            $name = $payload['display_name'] ?? null;
        }

        return $this->success(['name' => $name]);
    }

    private function saveLocation(Request $request): JsonResponse
    {
        $lat = $request->input('lat');
        $lon = $request->input('lon');
        $name = trim((string) $request->input('name', ''));
        $requestedSiteId = $request->input('site_id');

        if (! is_numeric($lat) || ! is_numeric($lon)) {
            return $this->error('Invalid coordinates', 422);
        }

        $user = $request->user();
        $site = null;

        if (is_numeric($requestedSiteId)) {
            $site = $user->sites()->where('sites.id', (int) $requestedSiteId)->first();

            if (! $site) {
                return $this->error('Site not found', 404);
            }
        }

        $site = $site ?: $user->activeSite ?: $user->sites()->orderBy('sites.id')->first();

        if (! $site) {
            $site = Site::query()->create([
                'owner_user_id' => $user->id,
                'name' => $name !== '' ? $name : 'Default Site',
                'slug' => Str::slug($name !== '' ? $name : 'default-site'),
                'timezone' => 'Australia/Sydney',
            ]);
            $site->users()->syncWithoutDetaching([$user->id => ['role' => 'owner']]);
        }

        if ($user->last_active_site_id !== $site->id) {
            $user->forceFill(['last_active_site_id' => $site->id])->save();
        }

        $site->update([
            'location_name' => $name !== '' ? $name : $site->location_name,
            'latitude' => $lat,
            'longitude' => $lon,
        ]);

        $config = SiteConfig::query()->firstOrNew([
            'site_id' => $site->id,
            'namespace' => 'gaip',
        ]);

        $payload = is_array($config->config) ? $config->config : [];
        $payload['location'] = array_filter([
            'name' => $site->location_name,
            'lat' => (float) $site->latitude,
            'lon' => (float) $site->longitude,
            'timezone' => $site->timezone,
        ], fn ($value) => $value !== null && $value !== '');

        $config->fill([
            'config' => $payload,
            'synced_at' => now(),
        ])->save();

        return $this->success([
            'saved' => true,
            'site_id' => $site->id,
            'name' => $site->location_name,
            'lat' => $site->latitude,
            'lon' => $site->longitude,
        ]);
    }

    private function hasValidNonce(Request $request): bool
    {
        $nonce = (string) ($request->input('nonce') ?? $request->input('_token') ?? '');
        $sessionToken = (string) ($request->session()->token() ?? '');

        return $nonce !== '' && ($nonce === $sessionToken || hash_equals(csrf_token(), $nonce));
    }

    private function success(array $data): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    private function error(string $message, int $status = 400, ?string $code = null): JsonResponse
    {
        return response()->json([
            'success' => false,
            'data' => array_filter([
                'message' => $message,
                'code' => $code,
            ]),
        ], $status);
    }
}
