<?php

namespace App\Http\Controllers;

use App\Models\SiteConfig;
use App\Support\SiteConfigWriter;
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

        // GH-447: through the one writer. This one replaces rather than
        // merges -- an analysis result is whole or it is nothing -- but it goes
        // the same way so that "what writes a config column" has a single
        // answer, and so a later merge here cannot quietly arrive unlocked.
        SiteConfigWriter::mutate(
            $validated['site_id'],
            'analysis_cache',
            fn () => [
                'metrics' => $validated['metrics'],
                'computed' => $validated['computed'] ?? null,
            ],
            $validated['analyzed_at'],
        );

        return response()->json(['ok' => true]);
    }
}
