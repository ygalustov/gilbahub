<?php

namespace App\Http\Controllers;

use App\Support\AnalysisResults;
use App\Support\NameOrder;
use App\Models\Sample;
use App\Models\Zone;
use App\Support\ZoneTypes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class DataController extends Controller
{
    private const SECTIONS = ['soil', 'tissue', 'water', 'loi', 'sensors', 'spray-log'];

    /** GH-822: what a row prints for a sample whose zone has no type -- the owner's words, one place. */
    private const TYPE_NOT_SET = 'Type not set';

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
        $zoneOf = [];

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
                /**
                 * GH-817 (the owner's request): newest date first, as before, and within one date by the
                 * name the row prints (`_label`, else `client_uid`, else `lab_ref` -- the view's own chain),
                 * through the one rule for names (`NameOrder`). The selection above is unchanged, so the
                 * hundred rows are the same hundred; only their order within a date changes.
                 */
                $printedName = function ($row): string {
                    $payload = is_array($row->payload) ? $row->payload : [];
                    foreach ([$payload['_label'] ?? null, $row->client_uid, $row->lab_ref] as $name) {
                        if ($name !== null && $name !== '') {
                            return (string) $name;
                        }
                    }

                    return '';
                };
                $rows = $rows->sort(function ($a, $b) use ($printedName) {
                    $da = $a->lab_date?->toDateString() ?? '';
                    $db = $b->lab_date?->toDateString() ?? '';
                    if ($da !== $db) {
                        return strcmp($db, $da);
                    }

                    return NameOrder::compare($printedName($a), $printedName($b));
                })->values();
                $total = $rows->count();
                if (in_array($section, ['soil', 'tissue', 'loi'], true)) {
                    $zoneOf = self::zoneTypeOfEachRow($rows);
                }
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

            // GH-546 (stage 1): one projection, from the owner of the result.
            // See AnalysisResults; this was one of eight hand-built copies.
            $analysisCache = AnalysisResults::forSite($activeSite);
        }

        return view('data', [
            'section'         => $section,
            'activeSite'      => $activeSite,
            'allSites'        => $allSites,
            'tabDates'        => $tabDates,
            'rows'            => $rows,
            'zoneOf'          => $zoneOf,
            'total'           => $total,
            'turfSpecies'     => $turfSpecies,
            'turfMethodology' => $turfMethodology,
            'locationName'    => $locationName,
            'analysisCache'   => $analysisCache,
        ]);
    }

    /**
     * GH-822 (queue item "Zones", stage C4) — THE ZONE TYPE OF EACH ROW, BY THE LINK IN THE DATABASE.
     *
     * The page printed the word a sample happened to carry (`payload.zone`). The owner's rule: where a sample is
     * linked to a zone with a type, print that type by its label from the one dictionary -- no plural, no list of
     * words of its own, no guessing from a name. This is the Data page's one reader of `zone_id` / `zone_type`;
     * the view prints what it is handed.
     *
     * @return array<int|string,array{zone:?string,zoneType:?string,zoneHint:?string}> by sample id; `zone` null
     *         means the sample has no zone ("—" on the page)
     */
    private static function zoneTypeOfEachRow($rows): array
    {
        $types = Zone::query()->whereIn('id', $rows->pluck('zone_id')->filter()->unique()->values()->all())
            ->pluck('zone_type', 'id')->all();
        $out = [];
        foreach ($rows as $row) {
            if ($row->zone_id === null || ! array_key_exists($row->zone_id, $types)) {
                $out[$row->id] = ['zone' => null, 'zoneType' => null, 'zoneHint' => null];
                continue;
            }
            $type = $types[$row->zone_id];
            $out[$row->id] = $type === null
                ? ['zone' => self::TYPE_NOT_SET, 'zoneType' => null, 'zoneHint' => null]
                // A stored key the dictionary does not know prints as stored, not as a word standing in for it.
                : ['zone' => ZoneTypes::zoneTypeLabel($type) ?? $type, 'zoneType' => $type,
                    'zoneHint' => ZoneTypes::areaGuidance($type)['example'] ?? null];
        }

        return $out;
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
