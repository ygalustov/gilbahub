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
                    ->orderByDesc('id')
                    ->limit(100)
                    ->get();
                $total = $rows->count();
            }
        }

        return view('data', [
            'section'    => $section,
            'activeSite' => $activeSite,
            'allSites'   => $allSites,
            'tabDates'   => $tabDates,
            'rows'       => $rows,
            'total'      => $total,
        ]);
    }
}
