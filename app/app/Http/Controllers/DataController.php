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
            $turfMethodology = self::effectiveMethodology($gaipConfig['turf']['methodology'] ?? null);
            // GH-520: null means the site has no methodology set. Upper-casing
            // null is deprecated in PHP 8, and an empty string here would read
            // as "set to nothing" rather than "not set".
            $turfMethodology = $turfMethodology === null ? null : strtoupper($turfMethodology);
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

    /*
     * GH-526 (PLAN-samples-sync-FINAL stage 1, item 2): destroy() removed.
     *
     * It was the Data page's own delete, a second route into `samples` beside
     * the hub's. It resolved the row by (id, user's ACTIVE site) rather than by
     * the row's own site, so it could 404 on a record the page was displaying
     * after an active-site change, and it left `site_summaries` pointing at the
     * sample it had just deleted. Deletion now has one place --
     * SampleController::destroy(), DELETE /api/samples/{sample} -- which checks
     * rights against the sample's OWN site, re-points or retires the summary,
     * and records who deleted it and from where.
     */

}
