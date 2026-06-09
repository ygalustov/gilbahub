<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class GeocodingController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $q = $request->validate(['q' => 'required|string|max:200'])['q'];

        $response = Http::withHeaders([
            'X-Goog-Api-Key' => config('services.google.maps_key'),
        ])->post('https://places.googleapis.com/v1/places:autocomplete', [
            'input' => $q,
        ]);

        if (! $response->ok()) {
            return response()->json(['suggestions' => []]);
        }

        $suggestions = collect($response->json('suggestions', []))
            ->map(function ($s) {
                $pred = $s['placePrediction'] ?? null;
                if (! $pred) return null;
                return [
                    'description' => $pred['text']['text'] ?? '',
                    'placeId'     => $pred['placeId'] ?? '',
                ];
            })
            ->filter()
            ->values();

        return response()->json(['suggestions' => $suggestions]);
    }

    public function details(string $placeId): JsonResponse
    {
        $response = Http::withHeaders([
            'X-Goog-Api-Key'  => config('services.google.maps_key'),
            'X-Goog-FieldMask' => 'location,formattedAddress',
        ])->get("https://places.googleapis.com/v1/places/{$placeId}");

        if (! $response->ok()) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $data = $response->json();

        return response()->json([
            'lat'  => $data['location']['latitude']  ?? null,
            'lon'  => $data['location']['longitude'] ?? null,
            'name' => $data['formattedAddress']       ?? '',
        ]);
    }
}
