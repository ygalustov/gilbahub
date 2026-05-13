<?php

namespace App\Http\Controllers;

use App\Models\SiteConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnalysisCacheController extends Controller
{
    /**
     * Store or replace the analysis result for the active site.
     * Called by hub-persistence.js after each analysis run (gaip:orchestrator-complete).
     * Uses site_configs namespace='analysis_cache' so no extra table is needed.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'site_id'     => 'required|string',
            'analyzed_at' => 'required|date',
            'metrics'     => 'required|array',
            'computed'    => 'nullable|array',
        ]);

        SiteConfig::updateOrCreate(
            ['site_id' => $validated['site_id'], 'namespace' => 'analysis_cache'],
            [
                'config'    => [
                    'metrics'     => $validated['metrics'],
                    'computed'    => $validated['computed'] ?? null,
                ],
                'synced_at' => $validated['analyzed_at'],
            ]
        );

        return response()->json(['ok' => true]);
    }
}
