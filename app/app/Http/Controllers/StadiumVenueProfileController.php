<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StadiumVenueProfileController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $profiles = DB::table('stadium_venue_profiles')
            ->where('user_id', $request->user()->id)
            ->orderBy('venue_id')
            ->get(['venue_id', 'profile']);

        $payload = [];

        foreach ($profiles as $profile) {
            $decoded = is_array($profile->profile)
                ? $profile->profile
                : json_decode((string) $profile->profile, true);

            $payload[$profile->venue_id] = is_array($decoded) ? $decoded : [];
        }

        return response()->json(['data' => $payload]);
    }

    public function upsert(Request $request, string $venueId): JsonResponse
    {
        abort_if(mb_strlen($venueId) > 120, 422, 'The venue id must not be greater than 120 characters.');

        $data = $request->validate([
            'turfType' => ['nullable', 'string', 'max:80'],
            'subCategory' => ['nullable', 'string', 'max:80'],
            'species' => ['nullable', 'string', 'max:120'],
            'variety' => ['nullable', 'string', 'max:120'],
            'construction' => ['nullable', 'string', 'max:120'],
            'overseedSpecies' => ['nullable', 'string', 'max:120'],
            'overseedVariety' => ['nullable', 'string', 'max:120'],
            'percentC3Cover' => ['nullable', 'numeric', 'between:0,100'],
            'venueEnv' => ['nullable', 'array'],
        ]);

        $profile = [
            'turfType' => (string) ($data['turfType'] ?? ''),
            'subCategory' => (string) ($data['subCategory'] ?? ''),
            'species' => (string) ($data['species'] ?? ''),
            'variety' => (string) ($data['variety'] ?? 'generic'),
            'construction' => (string) ($data['construction'] ?? ''),
            'overseedSpecies' => (string) ($data['overseedSpecies'] ?? ''),
            'overseedVariety' => (string) ($data['overseedVariety'] ?? ''),
            'percentC3Cover' => isset($data['percentC3Cover']) ? (float) $data['percentC3Cover'] : 0.0,
        ];

        if (isset($data['venueEnv'])) {
            $profile['venueEnv'] = $data['venueEnv'];
        }

        $query = DB::table('stadium_venue_profiles')
            ->where('user_id', $request->user()->id)
            ->where('venue_id', $venueId);

        if ($query->exists()) {
            $query->update([
                'profile' => json_encode($profile, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'updated_at' => now(),
            ]);
        } else {
            DB::table('stadium_venue_profiles')->insert([
                'user_id' => $request->user()->id,
                'venue_id' => $venueId,
                'profile' => json_encode($profile, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json([
            'data' => [
                'venue_id' => $venueId,
                'profile' => $profile,
            ],
        ]);
    }
}
