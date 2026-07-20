<?php

namespace App\Http\Controllers;

use App\Models\Sample;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class DataController extends Controller
{
    private const SECTIONS = ['soil', 'tissue', 'water', 'loi', 'sensors', 'spray-log'];

    public function show(Request $request, string $section = 'soil'): View
    {
        if (! in_array($section, self::SECTIONS, true)) {
            abort(404);
        }

        $user       = $request->user();
        $activeSite = $user->activeSite;
        $allSites   = $user->sites()->orderBy('name')->get() ?? collect();

        // Tab freshness — most recent date per sample type and spray log
        $tabDates = array_fill_keys(self::SECTIONS, null);
        if ($activeSite) {
            Sample::where('site_id', $activeSite->id)
                ->whereIn('sample_type', ['soil', 'tissue', 'water', 'loi'])
                ->whereNotNull('lab_date')
                ->orderByDesc('lab_date')
                ->get()
                ->groupBy('sample_type')
                ->each(function ($group, $type) use (&$tabDates) {
                    $tabDates[$type] = $group->first()?->lab_date?->toDateString();
                });

            $tabDates['spray-log'] = DB::table('spray_logs')
                ->where('site_id', $activeSite->id)
                ->orderByDesc('event_date')
                ->value('event_date');
        }

        // Load rows for the current section
        $rows  = collect();
        $total = 0;

        if ($activeSite) {
            if ($section === 'spray-log') {
                $rows  = DB::table('spray_logs')
                    ->where('site_id', $activeSite->id)
                    ->orderByDesc('event_date')
                    ->orderByDesc('id')
                    ->limit(200)
                    ->get();
                $total = $rows->count();
            } elseif ($section !== 'sensors') {
                $rows  = Sample::where('site_id', $activeSite->id)
                    ->where('sample_type', $section)
                    ->orderByDesc('lab_date')
                    ->orderByRaw('CASE WHEN client_uid IS NULL THEN 1 ELSE 0 END')
                    ->orderBy('client_uid')
                    ->orderByDesc('id')
                    ->limit(100)
                    ->get();
                $total = $rows->count();
            }
        }

        $turfSpecies     = null;
        $turfMethodology = null;
        $locationName    = null;
        $analysisCache   = null;

        if ($activeSite) {
            $gaipRecord      = $activeSite->configs()->where('namespace', 'gaip')->first();
            $gaipConfig      = is_array($gaipRecord?->config) ? $gaipRecord->config : [];
            $turfSpecies     = $gaipConfig['turf']['species'] ?? null;
            $turfMethodology = strtoupper(self::effectiveMethodology(
                $gaipConfig['turf']['methodology'] ?? null,
                $activeSite->latitude  !== null ? (float) $activeSite->latitude  : null,
                $activeSite->longitude !== null ? (float) $activeSite->longitude : null,
            ));
            $locationName    = $gaipConfig['location']['name'] ?? $activeSite->location_name ?: null;

            $cacheRecord = $activeSite->configs()->where('namespace', 'analysis_cache')->first();
            if ($cacheRecord) {
                $analysisCache = [
                    'metrics'    => $cacheRecord->config['metrics'] ?? null,
                    'computed'   => $cacheRecord->config['computed'] ?? null,
                    'analyzedAt' => $cacheRecord->synced_at?->toISOString(),
                ];
            }
        }

        return view('data', [
            'section'         => $section,
            'activeSite'      => $activeSite,
            'allSites'        => $allSites,
            'tabDates'        => $tabDates,
            'rows'            => $rows,
            'total'           => $total,
            'turfSpecies'     => $turfSpecies,
            'turfMethodology' => $turfMethodology,
            'locationName'    => $locationName,
            'analysisCache'   => $analysisCache,
        ]);
    }

    public function destroy(Request $request, int $id): \Illuminate\Http\JsonResponse
    {
        $activeSite = $request->user()->activeSite;
        abort_unless($activeSite, 403);
        abort_unless($request->user()->canEditSite($activeSite), 403);

        $sample = Sample::where('id', $id)
            ->where('site_id', $activeSite->id)
            ->firstOrFail();

        $sample->delete();

        return response()->json(['success' => true]);
    }
}
