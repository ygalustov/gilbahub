<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class SensorProxyController extends Controller
{
    public function hydrosight(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => ['required', 'string', 'max:1000'],
            'api_key' => ['required', 'string', 'max:255'],
        ]);

        $endpoint = $this->normaliseEndpoint($data['endpoint']);
        if ($endpoint === null) {
            return $this->error('Invalid endpoint');
        }

        $response = Http::acceptJson()
            ->timeout(20)
            ->withHeaders([
                'x-api-key' => $data['api_key'],
            ])
            ->get('https://api.hydrosight.au/v1'.$endpoint);

        if (! $response->successful()) {
            return $this->error(
                $this->extractErrorMessage($response, 'Hydrosight request failed'),
            );
        }

        return $this->success($response->json());
    }

    public function specconnect(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => ['required', 'string', 'max:1500'],
            'api_key' => ['required', 'string', 'max:255'],
        ]);

        $endpoint = $this->normaliseEndpoint($data['endpoint']);
        if ($endpoint === null) {
            return $this->error('Invalid endpoint');
        }

        $url = 'https://api.specconnect.net:6703'.$endpoint;
        $url = str_replace('{key}', rawurlencode($data['api_key']), $url);

        $response = Http::acceptJson()
            ->timeout(20)
            ->get($url);

        if (! $response->successful()) {
            return $this->error(
                $this->extractErrorMessage($response, 'SpecConnect request failed'),
            );
        }

        return $this->success($response->json());
    }

    private function normaliseEndpoint(string $endpoint): ?string
    {
        $endpoint = trim($endpoint);

        if ($endpoint === '' || preg_match('#^https?://#i', $endpoint)) {
            return null;
        }

        return '/'.ltrim($endpoint, '/');
    }

    private function extractErrorMessage($response, string $fallback): string
    {
        $json = $response->json();

        if (is_array($json)) {
            foreach (['message', 'Message', 'error', 'Error', 'errorMessage'] as $key) {
                if (isset($json[$key]) && is_string($json[$key]) && trim($json[$key]) !== '') {
                    return trim($json[$key]);
                }
            }
        }

        $body = trim((string) $response->body());

        return $body !== '' ? $body : $fallback;
    }

    private function success($data): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    private function error(string $message): JsonResponse
    {
        return response()->json([
            'success' => false,
            'data' => ['message' => $message],
        ]);
    }
}
