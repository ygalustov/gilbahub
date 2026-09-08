<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;

class PageController extends Controller
{
    public function plan(Request $request): View
    {
        return view('plan', $this->topbarData($request));
    }

    public function reports(Request $request): View
    {
        return view('reports', $this->topbarData($request));
    }

    private function topbarData(Request $request): array
    {
        $user       = $request->user();
        $activeSite = $user?->activeSite;
        $allSites   = $user?->sites()->orderBy('name')->get() ?? collect();

        $turfSpecies     = null;
        $turfMethodology = null;
        $locationName    = null;
        $analysisCache   = null;
        $gaipConfig      = [];

        if ($activeSite) {
            $gaipRecord      = $activeSite->configs()->where('namespace', 'gaip')->first();
            $gaipConfig      = is_array($gaipRecord?->config) ? $gaipRecord->config : [];
            $turfSpecies     = $gaipConfig['turf']['species'] ?? null;
            $turfMethodology = isset($gaipConfig['turf']['methodology'])
                ? strtoupper($gaipConfig['turf']['methodology'])
                : null;
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

        $savedLocation = [
            'lat' => $activeSite?->latitude  ?? '',
            'lon' => $activeSite?->longitude ?? '',
            'name' => $locationName ?? '',
        ];

        // GH-294: soil_texture_override lives on the Site model (falling back
        // to the account's soil_texture), not inside the gaip JSON config --
        // same site-override-then-account-fallback chain established at
        // SampleController.php:374 / HillLabsSampleTypes.resolveSoilTexture().
        // Needed by the Plan page's GAIP_STATE bridge below so
        // HillLabsSampleTypes.deriveCode() (AA certificate lookup, GH-291) has
        // a real texture to work with instead of always seeing '' (which
        // deriveCode() reads as "not sand" -> silently falls back to the
        // generic sands/others range regardless of the site's real texture).
        $soilTexture = $activeSite?->soil_texture_override ?: $activeSite?->account?->soil_texture;

        // GH-366: the site's most recent tissue analysis, as N/P/K percentages.
        //
        // GH-361 made computeProgram() derive the P/K removal ratio from a real
        // tissue sample where one exists (Hoxton audit D07a) and reads it from
        // GAIP_STATE. That worked in the Word export, which builds its state
        // per sample, but never fired on this page: the Plan bridge populates
        // turf/climate/location/inputs.soil and nothing else, GAIP_SampleManager
        // isn't loaded here, so GAIP_STATE.tissue was simply absent and the
        // calendar silently fell back to the generic textbook ratio. Screen and
        // export therefore disagreed on P/K -- the same UI-vs-export divergence
        // the audit raises at D31. Same server-side pass-through shape as
        // GH-294/GH-357 used for soil texture.
        $tissuePercent = null;
        if ($activeSite) {
            $latestTissue = $activeSite->samples()
                ->where('sample_type', 'tissue')
                ->orderByRaw('COALESCE(lab_date, sample_date) DESC')
                ->orderByDesc('id')
                ->first();

            if ($latestTissue) {
                $payload = is_array($latestTissue->payload) ? $latestTissue->payload : [];
                $numeric = static function ($value) {
                    // Lab payloads store these as strings ("4.57"); anything
                    // non-numeric or absent stays null so the JS side can tell
                    // "not measured" from a real reading rather than reading a
                    // fabricated 0 as a ratio.
                    return is_numeric($value) ? (float) $value : null;
                };
                $tissuePercent = [
                    'N' => $numeric($payload['N'] ?? null),
                    'P' => $numeric($payload['P'] ?? null),
                    'K' => $numeric($payload['K'] ?? null),
                    'sampleId' => $latestTissue->id,
                    'sampleDate' => ($latestTissue->lab_date ?? $latestTissue->sample_date)?->toDateString(),
                ];
            }
        }

        return compact(
            'activeSite', 'allSites', 'turfSpecies', 'turfMethodology',
            'locationName', 'analysisCache', 'gaipConfig', 'savedLocation',
            'soilTexture', 'tissuePercent'
        );
    }
}
